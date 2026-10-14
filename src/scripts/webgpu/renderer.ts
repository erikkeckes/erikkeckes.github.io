/// <reference types="@webgpu/types" />
import shaderSource from './hero.wgsl?raw';

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

/**
 * Starts the WebGPU hero scene on `canvas`.
 * Resolves to null when WebGPU is unavailable, so the caller can show a fallback.
 */
export async function createHeroRenderer(canvas: HTMLCanvasElement): Promise<HeroRenderer | null> {
	if (!navigator.gpu) return null;

	const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
	if (!adapter) return null;

	const device = await adapter.requestDevice();
	const context = canvas.getContext('webgpu');
	if (!context) return null;

	const format = navigator.gpu.getPreferredCanvasFormat();
	context.configure({ device, format, alphaMode: 'opaque' });

	const module = device.createShaderModule({ code: shaderSource });
	const pipeline = device.createRenderPipeline({
		layout: 'auto',
		vertex: { module, entryPoint: 'vs_main' },
		fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
		primitive: { topology: 'triangle-list' },
	});

	const uniforms = new Float32Array(UNIFORM_FLOATS);
	const uniformBuffer = device.createBuffer({
		size: uniforms.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	const bindGroup = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
	});

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

	device.lost.then((info) => {
		if (info.reason !== 'destroyed') console.warn('WebGPU device lost:', info.message);
	});

	return {
		destroy: () => {
			cancelAnimationFrame(frameId);
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerUp);
			resizeObserver.disconnect();
			visibilityObserver.disconnect();
			uniformBuffer.destroy();
			device.destroy();
		},
	};
}
