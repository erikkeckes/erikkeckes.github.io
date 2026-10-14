import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		image: z.string().optional(),
		/** Hero media on the project page: an mp4/webm path or a YouTube URL. Falls back to `image` */
		video: z.string().optional(),
		tags: z.array(z.string()).default([]),
		featured: z.boolean().default(false),
		importance: z.number().default(99),
		// Project page info row
		type: z.enum(['Personal', 'Professional', 'School']).optional(),
		team: z.enum(['Solo', 'Team']).optional(),
		teamSize: z.number().int().positive().optional(),
		role: z.string().optional(),
		technologies: z.array(z.string()).default([]),
	}),
});

const blog = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.coerce.date(),
		image: z.string().optional(),
		tags: z.array(z.string()).default([]),
		technologies: z.array(z.string()).default([]),
		featured: z.boolean().default(false),
	}),
});

export const collections = { projects, blog };
