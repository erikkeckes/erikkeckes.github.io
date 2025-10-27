---
layout: page
title: PBR renderer
description: PBR renderer on ps5
img: assets/img/PBR/pbr2.png
importance: 1
category: Side Project / school
---

A Physically Based Rendering (PBR) renderer designed for the PlayStation 5 and DirectX12 on pc, leveraging advanced rendering techniques to achieve realistic lighting and material effects. It utilizes the modern glTF format for models, ensuring efficient asset management, streamlined workflows, and compatibility with a wide range of 3D content creation tools.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/PBR/pbr2.png" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/PBR/pbr1.png" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
        <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/PBR/pbr3.png" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

This renderer implements few post process effects. These effect include bloom and tone mapping.
{% include video.liquid path="assets/video/PBR/pbr.mp4" class="img-fluid rounded z-depth-1" controls=true %}