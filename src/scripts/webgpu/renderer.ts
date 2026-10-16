/// <reference types="@webgpu/types" />
import shaderSource from './hero.wgsl?raw';
import glslSource from './hero.frag.glsl?raw';

export interface HeroRenderer {
	destroy: () => void;
}

// resolution (2) + time (1) + pad (1) + camera (2) + pad (2) + 4 colors (4 each)
const UNIFORM_FLOATS = 24;

// Orbit camera: azimuth spins the disk, inclination is the cosine of the viewing tilt
const START_INCLINATION = 0.2;
const MIN_INCLINATION = 0.06;
const MAX_INCLINATION = 0.95;
const DRAG_AZIMUTH_SPEED = 0.008; // radians per pixel
const DRAG_INCLINATION_SPEED = 0.003; // per pixel
// Idle orbit: the camera circles the hole and gently bobs above and below the disk
const IDLE_SPIN_SPEED = 0.12; // radians per second
const IDLE_BOB_AMOUNT = 0.12; // inclination swing either side of where the user left it
const IDLE_BOB_SPEED = 0.25; // radians per second of the bob cycle
const IDLE_RESUME_DELAY = 2; // seconds after a drag before the orbit picks up again
const IDLE_FADE_IN = 1.5; // seconds for the orbit to ease back to full speed
const CAMERA_DAMPING = 8; // higher = snappier follow

// Render below native resolution and let CSS upscale: the scene is all soft glow, so it
// barely shows, and fill rate is what limits phones. Scale drops further if frames are slow.
const isSmallScreen = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const MAX_RENDER_SCALE = isSmallScreen ? 0.6 : 1;
const MIN_RENDER_SCALE = 0.35;
const MAX_DPR = 1.5;
const SLOW_FRAME_MS = 22;
const FRAMES_PER_CHECK = 45;

/** Reads a `#rrggbb` CSS custom property from :root as linear-ish RGBA floats */
const readColor = (name: string): [number, number, number, number] => {
	const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	if (!match) return [0, 0, 0, 1];
	return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255, 1];
};

/** Draws one frame of the scene from the shared uniform block */
interface GpuBackend {
	draw: (uniforms: Float32Array) => void;
	destroy: () => void;
}

async function createWebGPUBackend(canvas: HTMLCanvasElement): Promise<GpuBackend | null> {
	if (!navigator.gpu) return null;

	const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
	if (!adapter) return null;

	const device = await adapter.requestDevice();
	// Only claim the canvas once we have a device, so a failed attempt leaves it free for WebGL
	const context = canvas.getContext('webgpu');
	if (!context) {
		device.destroy();
		return null;
	}

	const format = navigator.gpu.getPreferredCanvasFormat();
	context.configure({ device, format, alphaMode: 'opaque' });

	const module = device.createShaderModule({ code: shaderSource });
	const pipeline = device.createRenderPipeline({
		layout: 'auto',
		vertex: { module, entryPoint: 'vs_main' },
		fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
		primitive: { topology: 'triangle-list' },
	});

	const uniformBuffer = device.createBuffer({
		size: UNIFORM_FLOATS * 4,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	const bindGroup = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
	});

	device.lost.then((info) => {
		if (info.reason !== 'destroyed') console.warn('WebGPU device lost:', info.message);
	});

	return {
		draw: (uniforms) => {
			device.queue.writeBuffer(uniformBuffer, 0, uniforms);

			const encoder = device.createCommandEncoder();
			const pass = encoder.beginRenderPass({
				colorAttachments: [
					{
						view: context.getCurrentTexture().createView(),
						loadOp: 'clear',
						storeOp: 'store',
						clearValue: { r: 0, g: 0, b: 0, a: 1 },
					},
				],
			});
			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup);
			pass.draw(3);
			pass.end();
			device.queue.submit([encoder.finish()]);
		},
		destroy: () => {
			uniformBuffer.destroy();
			device.destroy();
		},
	};
}

// Same full-screen triangle and uv mapping as vs_main in hero.wgsl
const GLSL_VERTEX = `#version 300 es
out vec2 v_uv;
void main() {
	vec2 pos = vec2[3](vec2(-1.0, -3.0), vec2(-1.0, 1.0), vec2(3.0, 1.0))[gl_VertexID];
	gl_Position = vec4(pos, 0.0, 1.0);
	v_uv = pos * vec2(0.5, -0.5) + 0.5;
}`;

function createWebGL2Backend(canvas: HTMLCanvasElement): GpuBackend | null {
	const gl = canvas.getContext('webgl2', {
		alpha: false,
		antialias: false,
		depth: false,
		stencil: false,
		powerPreference: 'low-power',
	});
	if (!gl) return null;

	const compile = (type: number, source: string) => {
		const shader = gl.createShader(type)!;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		return shader;
	};

	// Built lazily so a lost context can be rebuilt once it is restored
	let program: WebGLProgram | null = null;
	let dataLocation: WebGLUniformLocation | null = null;
	let vao: WebGLVertexArrayObject | null = null;

	const build = () => {
		const vertex = compile(gl.VERTEX_SHADER, GLSL_VERTEX);
		const fragment = compile(gl.FRAGMENT_SHADER, glslSource);
		const linked = gl.createProgram()!;
		gl.attachShader(linked, vertex);
		gl.attachShader(linked, fragment);
		gl.linkProgram(linked);
		gl.deleteShader(vertex);
		gl.deleteShader(fragment);

		if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
			const log = gl.getProgramInfoLog(linked) || 'unknown error';
			gl.deleteProgram(linked);
			if (gl.isContextLost()) return false;
			throw new Error(`Hero shader failed to link: ${log}`);
		}
		program = linked;
		dataLocation = gl.getUniformLocation(linked, 'u_data');
		// WebGL 2 needs a bound VAO to draw, even without vertex attributes
		vao = gl.createVertexArray();
		return true;
	};

	if (!build()) return null;

	const onContextLost = (event: Event) => {
		event.preventDefault();
		program = null;
	};
	const onContextRestored = () => build();
	canvas.addEventListener('webglcontextlost', onContextLost);
	canvas.addEventListener('webglcontextrestored', onContextRestored);

	return {
		draw: (uniforms) => {
			if (!program) return;
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.useProgram(program);
			gl.uniform4fv(dataLocation, uniforms);
			gl.bindVertexArray(vao);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		},
		destroy: () => {
			canvas.removeEventListener('webglcontextlost', onContextLost);
			canvas.removeEventListener('webglcontextrestored', onContextRestored);
			if (program) gl.deleteProgram(program);
			if (vao) gl.deleteVertexArray(vao);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		},
	};
}

/** Prefers WebGPU, falling back to WebGL 2 when WebGPU is missing or fails to start */
async function createBackend(canvas: HTMLCanvasElement): Promise<GpuBackend | null> {
	try {
		const backend = await createWebGPUBackend(canvas);
		if (backend) return backend;
	} catch (error) {
		console.info('WebGPU failed to start, trying WebGL 2:', error);
	}
	return createWebGL2Backend(canvas);
}

/**
 * Starts the hero scene on `canvas`, using WebGPU or else WebGL 2.
 * Resolves to null when neither is available, so the caller can show a fallback.
 */
export async function createHeroRenderer(canvas: HTMLCanvasElement): Promise<HeroRenderer | null> {
	const backend = await createBackend(canvas);
	if (!backend) return null;

	const uniforms = new Float32Array(UNIFORM_FLOATS);
	uniforms.set(readColor('--color-bg'), 8);
	uniforms.set(readColor('--color-primary'), 12);
	uniforms.set(readColor('--color-secondary'), 16);
	uniforms.set(readColor('--color-accent'), 20);

	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Camera: the target follows the pointer, the current value eases toward it
	const camera = { azimuth: 0, inclination: START_INCLINATION };
	const target = { ...camera };
	let dragging: { pointerId: number; x: number; y: number } | null = null;

	const onPointerDown = (event: PointerEvent) => {
		dragging = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
		canvas.setPointerCapture(event.pointerId);
		canvas.classList.add('is-dragging');
		requestFrame();
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!dragging || event.pointerId !== dragging.pointerId) return;
		target.azimuth += (event.clientX - dragging.x) * DRAG_AZIMUTH_SPEED;
		target.inclination = Math.min(
			MAX_INCLINATION,
			Math.max(MIN_INCLINATION, target.inclination - (event.clientY - dragging.y) * DRAG_INCLINATION_SPEED),
		);
		dragging.x = event.clientX;
		dragging.y = event.clientY;
		requestFrame();
	};

	const onPointerUp = (event: PointerEvent) => {
		if (!dragging || event.pointerId !== dragging.pointerId) return;
		dragging = null;
		idleTimer = -IDLE_RESUME_DELAY;
		canvas.classList.remove('is-dragging');
	};

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerup', onPointerUp);
	canvas.addEventListener('pointercancel', onPointerUp);

	let lastCameraUpdate = 0;
	// Counts up from a negative delay after each drag; the orbit blends in once it passes 0
	let idleTimer = IDLE_FADE_IN;
	let bobPhase = 0;
	const updateCamera = (timeMs: number) => {
		const dt = lastCameraUpdate ? Math.min((timeMs - lastCameraUpdate) / 1000, 0.1) : 0;
		lastCameraUpdate = timeMs;

		let orbit = 0;
		if (!dragging && !reducedMotion) {
			idleTimer += dt;
			orbit = Math.min(Math.max(idleTimer / IDLE_FADE_IN, 0), 1);
		}
		// Advancing by orbit * dt keeps the motion continuous when it fades in or out
		target.azimuth += IDLE_SPIN_SPEED * dt * orbit;
		bobPhase += IDLE_BOB_SPEED * dt * orbit;

		const bob = Math.sin(bobPhase) * IDLE_BOB_AMOUNT * orbit;
		const inclination = Math.min(MAX_INCLINATION, Math.max(MIN_INCLINATION, target.inclination + bob));

		const ease = 1 - Math.exp(-CAMERA_DAMPING * dt);
		camera.azimuth += (target.azimuth - camera.azimuth) * ease;
		camera.inclination += (inclination - camera.inclination) * ease;
	};

	let renderScale = MAX_RENDER_SCALE;

	// Keep the drawing buffer matched to the displayed size times the render scale
	const resize = () => {
		const scale = Math.min(window.devicePixelRatio || 1, MAX_DPR) * renderScale;
		canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
		canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
	};

	// Step the resolution down while the average frame time stays too long
	let frameCount = 0;
	let frameTimeSum = 0;
	let lastFrame = 0;
	const adaptResolution = (timeMs: number) => {
		if (lastFrame) {
			frameTimeSum += timeMs - lastFrame;
			frameCount++;
		}
		lastFrame = timeMs;
		if (frameCount < FRAMES_PER_CHECK) return;

		const average = frameTimeSum / frameCount;
		frameCount = 0;
		frameTimeSum = 0;
		if (average > SLOW_FRAME_MS && renderScale > MIN_RENDER_SCALE) {
			renderScale = Math.max(MIN_RENDER_SCALE, renderScale * 0.8);
			resize();
		}
	};
	resize();
	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(canvas);

	const render = (timeMs: number) => {
		uniforms[0] = canvas.width;
		uniforms[1] = canvas.height;
		uniforms[2] = timeMs / 1000;
		uniforms[4] = camera.azimuth;
		uniforms[5] = camera.inclination;
		backend.draw(uniforms);
	};

	// Animate only while visible. Reduced-motion users get still frames that only update
	// while they drag (time stays frozen, the camera eases to where they let go)
	let frameId = 0;
	let visible = true;

	const keepAnimating = () => {
		if (!visible) return false;
		if (!reducedMotion) return true;
		const settling =
			Math.abs(target.azimuth - camera.azimuth) > 1e-3 ||
			Math.abs(target.inclination - camera.inclination) > 1e-3;
		return dragging !== null || settling;
	};

	const loop = (timeMs: number) => {
		frameId = 0;
		adaptResolution(timeMs);
		updateCamera(timeMs);
		render(reducedMotion ? 0 : timeMs);
		if (keepAnimating()) requestFrame();
		else lastCameraUpdate = 0;
	};

	function requestFrame() {
		if (!frameId) frameId = requestAnimationFrame(loop);
	}

	const visibilityObserver = new IntersectionObserver(([entry]) => {
		const wasVisible = visible;
		visible = entry.isIntersecting;
		if (visible && !wasVisible) {
			// Don't count the paused time as one very slow frame
			lastFrame = 0;
			lastCameraUpdate = 0;
			requestFrame();
		}
	});
	visibilityObserver.observe(canvas);

	requestFrame();

	return {
		destroy: () => {
			cancelAnimationFrame(frameId);
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerUp);
			resizeObserver.disconnect();
			visibilityObserver.disconnect();
			backend.destroy();
		},
	};
}
