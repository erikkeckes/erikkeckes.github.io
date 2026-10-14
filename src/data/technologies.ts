import { siCplusplus, siGit, siPlaystation5, siPython, siUnity, siUnrealengine } from 'simple-icons';

export interface Technology {
	name: string;
	/** SVG path in a 24x24 viewBox */
	path?: string;
	/** Text mark drawn in place of a logo when there is no path */
	short?: string;
}

export const technologies: Technology[] = [
	{ name: 'C++', path: siCplusplus.path },
	{ name: 'C#', short: 'C#' },
	{ name: 'Python', path: siPython.path },
	{ name: 'Unreal Engine', path: siUnrealengine.path },
	{ name: 'Unity', path: siUnity.path },
	{ name: 'DirectX 12', short: 'DX12' },
	{ name: 'HLSL', short: 'HLSL' },
	{ name: 'PlayStation 5', path: siPlaystation5.path },
	{ name: 'Git', path: siGit.path },
];
