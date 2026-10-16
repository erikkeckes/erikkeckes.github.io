#version 300 es
// WebGL 2 port of hero.wgsl, used when WebGPU isn't available. Keep the two in sync.
precision highp float;

// Same layout as the WebGPU uniform buffer, uploaded as 6 vec4s:
// [0] resolution.xy, time, pad  [1] camera.xy, pad  [2..5] bg, primary, secondary, accent
uniform vec4 u_data[6];

#define RESOLUTION u_data[0].xy
#define TIME u_data[0].z
// x: azimuth in radians, y: cosine of the inclination (0 = edge-on, 1 = face-on)
#define CAMERA u_data[1].xy
#define COLOR_BG u_data[2].rgb
#define COLOR_PRIMARY u_data[3].rgb
#define COLOR_SECONDARY u_data[4].rgb
#define COLOR_ACCENT u_data[5].rgb

in vec2 v_uv;
out vec4 fragColor;

const float PI = 3.14159265;
const float TAU = 6.2831853;

const float ZOOM = 0.68; // < 1 makes everything bigger on screen
const float HORIZON = 0.17; // event horizon radius
const float EINSTEIN = 0.34; // Einstein radius: how strongly the background bends
const float DISK_INNER = 0.27;
const float DISK_OUTER = 0.78;
const float STREAM_TWIST = 2.4; // how tightly the inflowing streams wind around the hole
const float STREAM_ARMS = 6.0; // spiral arms feeding the disk, evenly spaced around it
const int INFALL_COUNT = 7; // filaments falling in from all directions
const float INFALL_REACH = 2.4; // where filaments fade in from the screen edges
const float STAR_COLUMNS = 64.0; // star cells around the full circle

float hash21(vec2 p) {
	vec2 q = fract(p * vec2(123.34, 456.21));
	vec2 r = q + dot(q, q + 45.32);
	return fract(r.x * r.y);
}

float hash11(float x) {
	return fract(sin(x * 127.1) * 43758.5453);
}

float gauss(float x, float width) {
	float d = x / width;
	return exp(-d * d);
}

// Hot inner gas glows accent, cooling through primary to secondary at the rim
vec3 diskColor(float t) {
	vec3 inner = mix(COLOR_ACCENT, COLOR_PRIMARY, smoothstep(0.0, 0.45, t));
	return mix(inner, COLOR_SECONDARY, smoothstep(0.4, 1.0, t));
}

// Spiral streaks that drift inward over time
float swirl(float angle, float radius, float time) {
	float s = sin(angle * 3.0 + log(radius) * 14.0 + time * 2.4);
	float s2 = sin(angle * 7.0 - log(radius) * 9.0 + time * 3.1);
	return 0.55 + 0.3 * s + 0.15 * s2;
}

// Smoothly cycles primary -> secondary -> accent -> primary as t goes 0 -> 1
vec3 palette(float t) {
	float k = fract(t) * 3.0;
	if (k < 1.0) {
		return mix(COLOR_PRIMARY, COLOR_SECONDARY, smoothstep(0.0, 1.0, k));
	} else if (k < 2.0) {
		return mix(COLOR_SECONDARY, COLOR_ACCENT, smoothstep(1.0, 2.0, k));
	}
	return mix(COLOR_ACCENT, COLOR_PRIMARY, smoothstep(2.0, 3.0, k));
}

// Starfield sampled in log-polar coordinates around the hole (see hero.wgsl)
vec3 starfield(vec2 q, float time) {
	float r = max(length(q), 1e-4);
	float angle = atan(q.y, q.x) / TAU + 0.5;
	float logR = log(r);

	float flow = logR + time * 0.12;
	float twist = angle + time * 0.015 + 0.06 / (r + 0.15);

	vec2 grid = vec2(twist * STAR_COLUMNS, flow * 9.0);
	// Wrap the angular cell index so there is no seam where the angle jumps from 1 back to 0
	vec2 rawCell = floor(grid);
	vec2 cell = vec2(rawCell.x - STAR_COLUMNS * floor(rawCell.x / STAR_COLUMNS), rawCell.y);
	vec2 local = fract(grid) - 0.5;

	float h = hash21(cell);
	if (h < 0.82) {
		return vec3(0.0);
	}

	vec2 jitter = vec2(hash21(cell + 7.1), hash21(cell + 3.7)) - 0.5;
	// Stretch along the radial axis so stars streak as they fall
	vec2 d = (local - jitter * 0.6) * vec2(1.0, 0.35);
	float star = 1.0 - smoothstep(0.0, 0.12, length(d));

	float tint = hash21(cell + 1.3);
	vec3 color = mix(COLOR_ACCENT, vec3(1.0), 0.4);
	if (tint < 0.33) {
		color = COLOR_PRIMARY;
	} else if (tint < 0.66) {
		color = COLOR_SECONDARY;
	}

	float twinkle = 0.7 + 0.3 * sin(time * 3.0 + h * 40.0);
	return color * star * twinkle * (h - 0.82) * 6.0;
}

// Thin spiral arms of gas winding in from the screen edges and merging into the disk
vec3 streams(vec2 dl, float time) {
	float r = max(length(dl), 1e-4);
	float a = atan(dl.y, dl.x);

	float arm = (a - STREAM_TWIST * log(r / DISK_INNER)) * STREAM_ARMS / TAU;
	float offset = abs(fract(arm + 0.5) - 0.5) * TAU / STREAM_ARMS;
	float rawIndex = floor(arm + 0.5);
	float seed = hash11(rawIndex - STREAM_ARMS * floor(rawIndex / STREAM_ARMS) + 3.0);

	float taper = smoothstep(DISK_INNER, 3.5, r);
	float strand = gauss(offset, mix(0.03, 0.16, taper)) + 0.45 * gauss(abs(offset - mix(0.08, 0.2, taper)), mix(0.012, 0.06, taper));

	float dashes = 0.55 + 0.45 * sin(log(r) * 16.0 + time * (3.4 + seed * 1.4) + a + seed * 20.0);
	float fadeIn = smoothstep(DISK_INNER, DISK_OUTER, r);
	float fadeOut = 1.0 - smoothstep(3.0, 5.5, r);
	float falloff = 0.35 + 0.65 * DISK_OUTER / max(r, DISK_OUTER);
	float strength = 0.55 + 0.45 * seed;

	vec3 shift = palette(log(r) * 0.4 + time * 0.1 + seed + 0.15 * sin(time * 0.6 + a));
	vec3 color = mix(COLOR_ACCENT, shift, smoothstep(DISK_INNER, 2.5, r) * 0.8);
	return color * strand * dashes * fadeIn * fadeOut * falloff * strength * 0.9;
}

// Thin glowing filaments spiralling in from every direction in screen space
vec3 infall(vec2 p, float time) {
	float r = max(length(p), 1e-4);
	float a = atan(p.y, p.x);
	float logR = log(r);

	vec3 total = vec3(0.0);
	for (int i = 0; i < INFALL_COUNT; i++) {
		float fi = float(i);
		float seed = hash11(fi + 1.0);
		float base = fi / float(INFALL_COUNT) * TAU + seed * 0.7;
		float twist = 0.5 + seed * 1.1;

		float diff = a - (base + twist * logR);
		float wrapped = diff - TAU * floor((diff + PI) / TAU);
		float across = r * wrapped / sqrt(1.0 + twist * twist);

		float taper = mix(0.3, 2.6, smoothstep(HORIZON, INFALL_REACH, r));
		float width = (0.012 + 0.01 * seed) * taper;
		float core = gauss(across, width);
		float glow = gauss(across, width * 5.0) * 0.25;

		float pulses = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(logR * 10.0 + time * (3.5 + seed * 2.0) + seed * 30.0), 2.0);
		vec3 hue = palette(logR * 0.45 + time * (0.08 + seed * 0.06) + seed + 0.2 * sin(time * 0.9 + fi * 1.7));
		float shimmer = 0.85 + 0.15 * sin(time * 2.3 + fi * 2.1);

		float fadeIn = 1.0 - smoothstep(INFALL_REACH * 0.55, INFALL_REACH, r);
		float fadeOut = smoothstep(HORIZON, HORIZON * 1.8, r);

		total += hue * (core + glow) * pulses * shimmer * fadeIn * fadeOut;
	}
	return total * 0.75;
}

vec2 rotate(vec2 v, float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

void main() {
	// Square coordinates centred on the hole, fitted to the shorter side
	float minSide = min(RESOLUTION.x, RESOLUTION.y);
	vec2 p = (v_uv - 0.5) * RESOLUTION / minSide * vec2(2.0, -2.0) * ZOOM;
	float r = max(length(p), 1e-4);
	float time = TIME;

	// --- Lensed background
	vec2 q = p * (1.0 - (EINSTEIN * EINSTEIN) / (r * r));
	vec3 color = starfield(rotate(q, CAMERA.x * 0.3), time);

	color += COLOR_SECONDARY * 0.18 * exp(-r * 2.2);
	color += COLOR_PRIMARY * 0.25 * gauss(r - HORIZON * 1.6, HORIZON * 0.9);

	// --- Light falling in from every direction
	color += infall(rotate(p, CAMERA.x * 0.5), time);

	// --- Far side of the disk, lensed into an arch over the hole
	float tilt = clamp(CAMERA.y, 0.06, 1.0);
	float up = clamp(p.y / r, -1.0, 1.0);
	float archWeight = mix(mix(0.3, 1.0, max(up, 0.0)), 0.6, tilt);
	float arch = gauss(r - HORIZON * 1.45, HORIZON * 0.28) * archWeight;
	float archAngle = atan(p.y, p.x) + CAMERA.x;
	color += diskColor(0.25) * arch * swirl(archAngle, r, time) * 1.4;

	// --- Accretion disk (tilted ellipse)
	vec2 dp = vec2(p.x, p.y / tilt);
	vec2 dl = rotate(dp, CAMERA.x);
	float dr = length(dp);
	float diskMask = smoothstep(DISK_INNER, DISK_INNER + 0.04, dr) * (1.0 - smoothstep(DISK_OUTER - 0.25, DISK_OUTER, dr));
	float diskT = clamp((dr - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);
	float beaming = 1.0 + 0.75 * (-dp.x / max(dr, 1e-4));
	float heat = pow(DISK_INNER / max(dr, DISK_INNER), 1.6);
	float beam = mix(beaming, 1.0, tilt * tilt);
	vec3 disk = diskColor(diskT) * diskMask * heat * beam * swirl(atan(dl.y, dl.x), dr, time) * 1.6;
	disk += streams(dl, time) * beam;

	float isFront = step(p.y, 0.0);
	color += disk * (1.0 - isFront);

	// --- Event horizon and photon ring
	float horizon = 1.0 - smoothstep(HORIZON * 0.94, HORIZON, r);
	color *= 1.0 - horizon;
	color += mix(COLOR_ACCENT, vec3(1.0), 0.3) * gauss(r - HORIZON * 1.04, HORIZON * 0.05) * 1.2;

	color += disk * isFront;

	color = color / (1.0 + color * 0.6);
	color = COLOR_BG + color;

	float edgeFade = smoothstep(0.0, 0.15, v_uv.y) * (1.0 - smoothstep(0.85, 1.0, v_uv.y));
	color = mix(COLOR_BG, color, edgeFade);

	fragColor = vec4(color, 1.0);
}
