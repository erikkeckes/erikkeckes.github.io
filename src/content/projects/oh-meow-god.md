---
title: Oh! Meow God | Graphics Programmer
description: Platformer and puzzle 3D game build in fully custom engine
contribution : Cascaded shadows maps, HSV color shift on materials, materials parameters, Volumetric clouds, post process effects
image: /assets/img/ohmeowgod/SplashArt_OMG.png
video: /assets/video/Oh-Meow-God-trailer.mp4
featured: true
tags: [School, Team, Game, OpenGl, PlayStation 5, C++,]
importance: 3
type: School
team: Team
role: Graphics programmer
technologies: [Custom Engine, C++, OpenGl, PlayStation 5]
---

Oh! Meow God is a 3D platformer and puzzle game built by a student team in a fully custom C++ engine, running on both PC (OpenGL) and PlayStation 5. With no off-the-shelf engine to lean on, every visual feature in the game had to be written by the team itself.

![Oh! Meow God key art](/assets/img/ohmeowgod/SplashArt_OMG.png)

## My role

As a Graphics Programmer, I was responsible for a large part of the game's look - from lighting and shadows to the sky and the final image on screen.

### Cascaded shadow maps
I implemented cascaded shadow maps for the game's directional light, giving crisp shadows close to the player while still covering the whole level in the distance. Clear shadows are important in a platformer, as they help players judge where they are going to land.

### Volumetric clouds
I created volumetric clouds that give the sky depth and atmosphere, making the world feel larger and more alive than a flat skybox could.

### Post-process effects
I built post-process effects that shape the final image and give the game its stylized, polished look.

### Material parameters
I added support for per-material parameters, so artists and designers could tweak how objects look without needing a programmer or new shaders.

### HSV color shift
I implemented HSV color shifting on materials, allowing a single asset to be recolored in hue, saturation and brightness. This let the team create visual variety from the same assets and tune the colors of each level.

### Working across platforms
All of these features had to run on both the PC OpenGL renderer and PlayStation 5, which meant keeping them performant and consistent on both platforms.
