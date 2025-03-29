---
layout: page
title: CPU raytracer
description: CPU whited raytracer
img: assets/img/Raytracer/Screenshot 2025-03-24 202423.png
importance: 3
category:  Side Project / school
---

This project was developed during the first year at BUAS, where the focus was on learning and implementing ray tracing—a modern graphics technique used to simulate light, shadows, and reflections. The project utilized a CPU-based white raytracer, with an emphasis on voxels for rendering. However, it wasn't limited to just voxels; the system was also capable of handling other geometric shapes, such as spheres and planes, expanding its flexibility and versatility in ray tracing applications.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
{% include video.liquid path="assets/video/Raytracer/primitives.mp4" class="img-fluid rounded z-depth-1" controls=true %}
    </div>
</div>

A range of visual effects was integrated into the material system of the raytracer, allowing for dynamic manipulation of material properties to achieve a variety of visual effects.
<br>
* Glass and Reflections
Materials like glass were implemented by adjusting properties such as refraction index and reflection index, allowing for the simulation of light bending through the surface, producing realistic reflections and refractions. Multiple bounces of light through the glass material create a more dynamic and complex visual, especially when interacting with the environment.
<br>
* Beer’s Law
To simulate how light absorbs and scatters through transparent or semi-transparent materials, Beer’s Law was applied. This allows materials like liquids or fog to have their absorption and scattering properties adjusted, creating effects for substances like beer or other liquid-based visuals.
<br>
* Multiple Bounces
For reflective and surfaces such as mirrors, the material system was designed to support multiple bounces of reflection. This allows light to interact with a mirrored surface multiple times, producing detailed, dynamic reflections that react naturally to the environment and light sources.

Would you like to expand on any of these effects or discuss how they are optimized in the game?
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
{% include video.liquid path="assets/video/Raytracer/Menu.mp4" class="img-fluid rounded z-depth-1" controls=true %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
{% include video.liquid path="assets/video/Raytracer/glass.mp4" class="img-fluid rounded z-depth-1" controls=true %}
    </div>
        <div class="col-sm mt-3 mt-md-0">
{% include video.liquid path="assets/video/Raytracer/beers law.mp4" class="img-fluid rounded z-depth-1" controls=true %}
    </div>
</div>

Since the raytracer was focused on voxels, voxel grid traversal played a critical role in the rendering process. To improve overall performance, a multi-level grid system was implemented, allowing for Level of Detail (LOD) optimization.

* Multi-Level Grid System
<br>
This system generates multiple LODs for the voxel grid. Traversal begins at the lowest LOD of the grid, where fewer voxels are considered. As the ray moves closer to its target, the system progressively switches to higher LODs, ultimately reaching the original grid with full detail only when necessary.
<br>
This technique significantly reduces the computational time, as lower LODs are used when the ray is far from the grid, while higher LODs are utilized only for finer, more detailed results.
<br>
Alterantive technique is oct trees.
{% include video.liquid path="assets/video/Raytracer/multilevelgrid.mp4" class="img-fluid rounded z-depth-1" controls=true %}

// Add reprojection

A simple yet engaging maze puzzle game was built on top of this ray tracer, featuring a unique light-based challenge—players can only see a limited portion of the maze, making navigation more difficult.

* Ray-Traced Physics
<br>
Instead of using a traditional physics engine, ray tracing was also utilized for collision detection. Since the player is represented as a sphere, additional rays are cast outward from the center of the sphere in all directions. When a ray hits an obstacle, it returns a distance value, allowing for precise collision detection and position adjustments.

* Optimized Performance
<br>
To maintain smooth performance, resource-intensive effects—such as multi-bounce reflections and glass effects—are only enabled in the menu screen, where performance impact is less critical. This approach ensures the game remains visually appealing without sacrificing real-time gameplay fluidity.
{% include video.liquid path="assets/video/Raytracer/game.mp4" class="img-fluid rounded z-depth-1" controls=true %}