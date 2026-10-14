---
title: Scaling Procedural Wind Tree Animations
description: Optimizing the bending algorithm to render larger numbers of animated trees.
date: 2025-02-22
image: /assets/img/treeOpt/ShaderAnalisis.png
tags: [DirectX 12, GPU programming, Animation]
---

The testing scenario for this post involves rendering 100 trees, each with different positions and rotations. Frustum culling and instancing are not included in this performance test, as the focus is primarily on optimizing the bending algorithm itself. The test tree model features 4 levels of bones and approximately 245,662 vertices.
