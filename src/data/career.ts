export interface CareerEntry {
	role: string;
	place: string;
	start: number;
	/** Omit while the role is ongoing ("present") */
	end?: number;
	description: string;
	skills?: string[];
}

export const experience: CareerEntry[] = [
	{
		role: 'Unreal Engine Developer',
		place: 'QOPRO game studio',
		start: 2023,
		description:
			'Developing new features, fixing bugs and optimizing the game for better performance. One of my main priorities is optimizing network performance and implementing new multiplayer features.',
		skills: ['Job', 'Unreal Engine', 'C++', 'Blueprints', 'Multiplayer'],
	},
	{
		role: 'Lecturer',
		place: 'Hemisfera',
		start: 2021,
		end: 2022,
		description:
			'Teaching children how to develop games with various software tools, covering 2D and 3D graphics, programming and game design.',
		skills: ['Job', 'Teaching'],
	},
];

export const education: CareerEntry[] = [
	{
		role: "Bachelor's degree, Game Technology (Programming)",
		place: 'BUAS, Breda, Netherlands',
		start: 2023,
		description: 'Focus on game and graphics programming.',
		skills: ['School'],
	},
	{
		role: "Bachelor's degree, Information Technology and Electronics",
		place: 'STU FEI, Bratislava, Slovakia',
		start: 2022,
		end: 2023,
		description: 'Information technology and electronics.',
		skills: ['School'],
	},
	{
		role: 'High School, Information Technology',
		place: 'SPŠE Š. A. Jedlíka, Nové Zámky, Slovakia',
		start: 2018,
		end: 2022,
		description: 'Information technology.',
		skills: ['School'],
	},
];

export const about = {
	name: 'Erik Kečkéš',
	photo: '/assets/img/me.jpg',
	bio: 'I am a university student specializing in game programming, with a focus on game and graphics programming. Passionate about technology, I constantly explore and experiment with new tools, techniques and frameworks to enhance my projects. I enjoy pushing the boundaries of interactive experiences by integrating cutting-edge technologies and refining my skills through hands-on development.',
	languages: ['Slovak', 'English', 'Czech'],
	interests: ['Graphics programming', 'Game development', 'Board games', 'Travelling'],
};
