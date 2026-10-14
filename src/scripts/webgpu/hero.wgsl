// Cheap 2D black hole: no ray marching, everything is analytic per pixel.
// - Background stars live in log-polar space and scroll inward, so light "falls in"
// - Thin-lens point-mass deflection bends the starfield around the hole
// - Accretion disk is a tilted ellipse; its far side is faked as a lensed ring above the hole
// - Two spiral light streams feed the disk from the sides
// - "Camera" = azimuth (spins disk + streams in their plane) and inclination (disk squash)

struct Uniforms {
	resolution: vec2f,
	time: f32,
	_pad0: f32,
	// x: azimuth in radians, y: cosine of the inclination (0 = edge-on, 1 = face-on)
	camera: vec2f,
	_pad1: vec2f,
	colorBg: vec4f,
	colorPrimary: vec4f,
	colorSecondary: vec4f,
	colorAccent: vec4f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOut {
	@builtin(position) position: vec4f,
	@location(0) uv: vec2f,
};

// One triangle that covers the whole screen, no vertex buffer needed
@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOut {
	var pos = array<vec2f, 3>(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
	var out: VertexOut;
	out.position = vec4f(pos[index], 0.0, 1.0);
	out.uv = pos[index] * vec2f(0.5, -0.5) + 0.5;
	return out;
}

const PI = 3.14159265;
const TAU = 6.2831853;

const ZOOM = 0.68; // < 1 makes everything bigger on screen
const HORIZON = 0.17; // event horizon radius
const EINSTEIN = 0.34; // Einstein radius: how strongly the background bends
const DISK_INNER = 0.27;
const DISK_OUTER = 0.78;
const STREAM_TWIST = 2.4; // how tightly the inflowing streams wind around the hole
const STAR_COLUMNS = 64.0; // star cells around the full circle

fn hash21(p: vec2f) -> f32 {
	let q = fract(p * vec2f(123.34, 456.21));
	let r = q + dot(q, q + 45.32);
	return fract(r.x * r.y);
}

fn gauss(x: f32, width: f32) -> f32 {
	let d = x / width;
	return exp(-d * d);
}

// Hot inner gas glows accent, cooling through primary to secondary at the rim
fn diskColor(t: f32) -> vec3f {
	let inner = mix(u.colorAccent.rgb, u.colorPrimary.rgb, smoothstep(0.0, 0.45, t));
	return mix(inner, u.colorSecondary.rgb, smoothstep(0.4, 1.0, t));
}

// Spiral streaks that drift inward over time
fn swirl(angle: f32, radius: f32, time: f32) -> f32 {
	let s = sin(angle * 3.0 + log(radius) * 14.0 + time * 2.4);
	let s2 = sin(angle * 7.0 - log(radius) * 9.0 + time * 3.1);
	return 0.55 + 0.3 * s + 0.15 * s2;
}

// Starfield sampled in log-polar coordinates around the hole. Scrolling the log-radius
// moves every star toward the centre; the angle twists faster close in, like an inspiral.
fn starfield(q: vec2f, time: f32) -> vec3f {
	let r = max(length(q), 1e-4);
	let angle = atan2(q.y, q.x) / TAU + 0.5;
	let logR = log(r);

	let flow = logR + time * 0.12;
	let twist = angle + time * 0.015 + 0.06 / (r + 0.15);

	let grid = vec2f(twist * STAR_COLUMNS, flow * 9.0);
	// Wrap the angular cell index so there is no seam where the angle jumps from 1 back to 0
	let rawCell = floor(grid);
	let cell = vec2f(rawCell.x - STAR_COLUMNS * floor(rawCell.x / STAR_COLUMNS), rawCell.y);
	let local = fract(grid) - 0.5;

	let h = hash21(cell);
	if (h < 0.82) {
		return vec3f(0.0);
	}

	let jitter = vec2f(hash21(cell + 7.1), hash21(cell + 3.7)) - 0.5;
	// Stretch along the radial axis so stars streak as they fall
	let d = (local - jitter * 0.6) * vec2f(1.0, 0.35);
	let star = 1.0 - smoothstep(0.0, 0.12, length(d));

	let tint = hash21(cell + 1.3);
	var color = mix(u.colorAccent.rgb, vec3f(1.0), 0.4);
	if (tint < 0.33) {
		color = u.colorPrimary.rgb;
	} else if (tint < 0.66) {
		color = u.colorSecondary.rgb;
	}

	let twinkle = 0.7 + 0.3 * sin(time * 3.0 + h * 40.0);
	return color * star * twinkle * (h - 0.82) * 6.0;
}

// Two thin spiral arms of gas winding in from far out (the sides of the screen) and
// merging into the disk; dashes along each arm scroll inward
fn streams(dl: vec2f, time: f32) -> vec3f {
	let r = max(length(dl), 1e-4);
	let a = atan2(dl.y, dl.x);

	// Angle of the arm at this radius; two arms half a turn apart
	let arm = (a - STREAM_TWIST * log(r / DISK_INNER)) / PI;
	let offset = abs(fract(arm + 0.5) - 0.5) * PI;
	let strand = gauss(offset, 0.1 + 0.03 * r) + 0.45 * gauss(abs(offset - 0.22), 0.05);

	let dashes = 0.55 + 0.45 * sin(log(r) * 16.0 + time * 4.0 + a);
	let fadeIn = smoothstep(DISK_INNER, DISK_OUTER, r);
	let fadeOut = 1.0 - smoothstep(3.0, 5.5, r);
	let falloff = 0.35 + 0.65 * DISK_OUTER / max(r, DISK_OUTER);

	let color = mix(u.colorAccent.rgb, u.colorPrimary.rgb, smoothstep(DISK_OUTER, 2.5, r));
	return color * strand * dashes * fadeIn * fadeOut * falloff * 0.9;
}

fn rotate(v: vec2f, angle: f32) -> vec2f {
	let c = cos(angle);
	let s = sin(angle);
	return vec2f(c * v.x - s * v.y, s * v.x + c * v.y);
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
	// Square coordinates centred on the hole, fitted to the shorter side
	let minSide = min(u.resolution.x, u.resolution.y);
	let p = (in.uv - 0.5) * u.resolution / minSide * vec2f(2.0, -2.0) * ZOOM;
	let r = max(length(p), 1e-4);
	let time = u.time;

	// --- Lensed background -------------------------------------------------
	// Thin-lens point mass: what we see at p comes from p * (1 - E^2 / r^2)
	let q = p * (1.0 - (EINSTEIN * EINSTEIN) / (r * r));
	var color = starfield(q, time);

	// Faint glow of light piling up around the hole
	color += u.colorSecondary.rgb * 0.18 * exp(-r * 2.2);
	color += u.colorPrimary.rgb * 0.25 * gauss(r - HORIZON * 1.6, HORIZON * 0.9);

	// --- Far side of the disk, lensed into an arch over the hole -------------
	let tilt = clamp(u.camera.y, 0.06, 1.0);
	let up = clamp(p.y / r, -1.0, 1.0);
	// Edge-on the far side shows as an arch over the top; face-on it becomes a full ring
	let archWeight = mix(mix(0.3, 1.0, max(up, 0.0)), 0.6, tilt);
	let arch = gauss(r - HORIZON * 1.45, HORIZON * 0.28) * archWeight;
	let archAngle = atan2(p.y, p.x) + u.camera.x;
	color += diskColor(0.25) * arch * swirl(archAngle, r, time) * 1.4;

	// --- Accretion disk (tilted ellipse) -------------------------------------
	// Undo the viewing tilt to get disk-plane coordinates, then spin by the camera azimuth
	let dp = vec2f(p.x, p.y / tilt);
	let dl = rotate(dp, u.camera.x);
	let dr = length(dp);
	let diskMask = smoothstep(DISK_INNER, DISK_INNER + 0.04, dr) * (1.0 - smoothstep(DISK_OUTER - 0.25, DISK_OUTER, dr));
	let diskT = clamp((dr - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);
	// Relativistic beaming: the side moving toward us is brighter
	let beaming = 1.0 + 0.75 * (-dp.x / max(dr, 1e-4));
	let heat = pow(DISK_INNER / max(dr, DISK_INNER), 1.6);
	// Beaming fades out face-on, where nothing moves toward or away from us
	let beam = mix(beaming, 1.0, tilt * tilt);
	var disk = diskColor(diskT) * diskMask * heat * beam * swirl(atan2(dl.y, dl.x), dr, time) * 1.6;
	disk += streams(dl, time) * beam;

	// Back half of the disk sits behind the hole, front half crosses in front of it
	let isFront = step(p.y, 0.0);
	color += disk * (1.0 - isFront);

	// --- Event horizon and photon ring ---------------------------------------
	let horizon = 1.0 - smoothstep(HORIZON * 0.94, HORIZON, r);
	color *= 1.0 - horizon;
	color += mix(u.colorAccent.rgb, vec3f(1.0), 0.3) * gauss(r - HORIZON * 1.04, HORIZON * 0.05) * 1.2;

	color += disk * isFront;

	// Soft tone map so additive glow never clips harshly, then sit it on the page background
	color = color / (1.0 + color * 0.6);
	color = u.colorBg.rgb + color;

	// Fade to the page background at the top and bottom edges
	let edgeFade = smoothstep(0.0, 0.15, in.uv.y) * (1.0 - smoothstep(0.85, 1.0, in.uv.y));
	color = mix(u.colorBg.rgb, color, edgeFade);

	return vec4f(color, 1.0);
}
