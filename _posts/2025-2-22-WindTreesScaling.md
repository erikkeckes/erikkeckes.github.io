---
layout: post
title: Scaling Procedural Wind Tree Animations
description: Scaling up Tree numbers
data : 2025-5-22
tags: GPU programming DirectX12
categories: GPU programming DirectX12
---

<h1>
Scaling provedural wind tree animations for larger amounts
</h1>
In the previous post, I explained how wind effects on trees can be simulated using bending and stretching techniques. In this post, I’ll focus on the bending algorithm and how it can be scaled to handle a larger number of trees efficiently. Open-world games often display more than just a few trees at once, and we still need to leave enough GPU time for rendering everything else not just the trees.<br>

<h2>Testing Scenario</h2>
The testing scenario for this post involves rendering 100 trees, each with different positions and rotations. Frustum culling and instancing are not included in this performance test, as the focus is primarily on optimizing the bending algorithm itself. The test tree model features 4 levels of bones and approximately 245,662 vertices.
<br>

<h2>Testing Hardware</h2>
All tests were conducted on a Lenovo Legion 5 equipped with a Ryzen 7 5800H CPU, 16 GB of RAM, and an NVIDIA GeForce RTX 3060 GPU with 6 GB of VRAM.

<h2>Identifing the problem</h2>
The main issue with the previous implementation is that bending is applied per vertex. This means that a high-resolution tree could end up recalculating the bending effect thousands of times, depending on the vertex count.<br>

This assumption is confirmed using NVIDIA Nsight. Rendering all 100 trees takes approximately 177 ms in total, which breaks down to around 1.77 ms per tree. This is especially problematic given that the pixel shader is minimal and only outputs a solid color, with no PBR or other advanced shading techniques involved.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/treeOpt/originalTime.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div> 
</div>

After adjusting code to provide debuging for shaders, NVidia Insights allows to inspect shader code for potentional optimazations. After analizing for a while main botlenec was found.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/treeOpt/ShaderAnalisis.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div> 
</div>

As expected, each vertex takes too much time due to the need to traverse the bone hierarchy, recalculate rotation matrices, compute bone weights, and apply them. To better illustrate what’s happening during this process, here is a simplified pseudocode example:

``` hlsl
// per vertex of mesh, scales per complexity of mesh
{
    // per level of bone could from 1 bone to 5,6 ... 
    // no limit in this implementation
    {
        Bone bone = boneBuffer[currentIndex];
        float3x3 rotaionMatrix = bendBranch(bone);
        float wight = GetWeight(bone);
        // apply roation
    }
}
```

<h2>Theory for reducing the compution load</h2>
Since larger groups of vertices are typically influenced by the same bones (as is common in regular animations), we can leverage this to optimize the algorithm. However, this approach may require reorganizing how the data is stored and accessed on the GPU.<br>

Since rotation matrices can be reused across multiple vertices, why not move their calculation to a compute shader and compute each rotation only once? Offloading this computation to a compute shader can drastically reduce redundant calculations of rotation matrices, significantly improving performance.

```
booth are representing worst case scenarion
BoneCount -> Number of bones
MaxBones -> top limit of bones that could be per vertex
VertexCount -> total vertex count of mesh

Original:
Max Computation Count = VertexCount * MaxBones;
 
With compute:
Max Computation Count = BoneCount;
```

From the example above, it’s clear that moving the calculations to a compute shader should provide much more manageable and stable performance when processing all bones. This way, meshes with more vertices can be rendered without a significant impact on speed—aside from the natural increase caused by drawing more vertices.

<h2>Practical implementation</h2>

This change requires adding a buffer that can be shared between the compute and graphics pipelines. This buffer will store all the precomputed rotation matrices.<br>

The shader used to compute the rotation matrices remains unchanged, it’s the same shader code from the previous post.

```hlsl
float3 GetWindTangent(float3 windVector)
{
    return float3(-windVector.z, windVector.y, windVector.x);
}

float3x3 SimulateBranch(TreeBone bone, float3 localWind)
{
    float3 windTangent = GetWindTangent(localWind);
    
    // determine branch orientation relative to the wind
    float dota = dot(bone.direction, localWind);
    float dotb = dot(bone.direction, normalize(windTangent));
    
    uint boneLevel = bone.level;
    float inertia = 0.5 / boneLevel;
    
    float3x3 modelRotation = (float3x3) instanceData.worldMatrix;
    float3 localSideShift = mul(simulation.sideAngleShift.xyz, modelRotation);
    float3 localBackShift = mul(simulation.backAngleShift.xyz, modelRotation);
    float3 localFrontShift = mul(simulation.frontAmplitude.xyz, modelRotation);
    
    // calculate parameters for rules
    float t = dota * 0.5f + 0.5f;
    float3 amplitudes = lerp(simulation.backAmplitude, simulation.frontAmplitude, t).xyz;
    float3 angleShifts = lerp(localBackShift, localFrontShift, t);
    
    float amplitude0 = lerp3(amplitudes.x, amplitudes.y, amplitudes.z, inertia);
    float angleShift0 = lerp3(angleShifts.x, angleShifts.y, angleShifts.z, inertia);

    float frequency0 = (dota > 0) ? simulation.frontFrequency : simulation.backFrequency;
	
    float amplitude1 = simulation.sideAmplitude.y;
    float angleShift1 = localSideShift.y * dotb;
    float frequency1 = simulation.sideFrequency;
    
    float q0Modififier = (sin(time * boneLevel * frequency0) + 1) * 0.5;
    float4 q0 = quatAxisAngle(normalize(windTangent), (angleShift0 + amplitude0 * q0Modififier * windData.windPower));
	// cacluate quaternion representing bending of the branch perpendicular to main trunk
    float q1Modifier = (sin(time * boneLevel * frequency1) + 1) * 0.5;
    float4 q1 = quatAxisAngle(float3(0, 0, 1), (angleShift1 + amplitude1 * q1Modifier * windData.windPower));
	
	// combine bending
    float4 q = lerp(q1, q0, abs(dota));
	
    return quatToMatrix(q);
}

void main(ComputeShaderInput IN)
{
    RWStructuredBuffer<float3x3> matricesBuffer;
    
    uint elements, stride;
    matricesBuffer.GetDimensions(eleents, stride);

    uint linearIndex = computedIndex;

    if (linearIndex < elements)
    {
        RWStructuredBuffer<TreeBone> bonesBuffer;
    
        // transform wind to local space
        float3 wind = mul(transpose(instanceData.worldMatrix), float4(windData.windDirection, 1)).xyz;
        wind = normalize(wind);
        
        TreeBone bone = bonesBuffer[linearIndex];
        if (GetBoneLevel(bone) > 0)
        {
            matricesBuffer[linearIndex] = SimulateBranch(bone, wind);
        }
        else
        {
            // root bone is calculated differently
            matricesBuffer[linearIndex]
             = quatToMatrix(quatAxisAngle(wind, windData.windPower * 0.35 + (0.25 * windData.windPower * (cos(time) + 1) * 0.5)));
        }
    }
}
```

After compute shader is writen, vertex shader needs adjusting too. Traversing part will be need to adjusted. <br>
Main change is instead of calculating the rotation matrix we just read it from buffer and directly apply. Only weight calculation and lerp between positions remained from original calculation. <br>

After writing the compute shader, the vertex shader also needs to be adjusted. Specifically part that traverses the bones. Instead of calculating the rotation matrix per vertex, the vertex shader now simply reads the precomputed matrices from the buffer and applies them directly. The only remaining calculations are the bone weight computations and the interpolation (lerp) between positions from the original algorithm.

Before:
```hlsl
    for (int i = level; i > 0; i--)
    {
        // calculate bend position
        output = bendBranch(output, bone, localDirection, wind_tangent_model, 0);
        bone = bonesBuffer[bone.parent];
    }
```
After:
```hlsl
    for (int i = level; i > 0; i--)
    {
        // calculate bend position
        float3x3 modelRotation = matricies[joint];
        joint = jointsBuffer[bone.parent];
        
        // position relative to bone origin
        float3 branchPos = output.position.xyz - bone.position;
    
        float weight = clamp(length(branchPos) / bone.length, 0, 1);
        
        float3 newPos = mul(branchPos, modelRotation).xyz;
        newPos = lerp(branchPos, newPos, weight);
        newPos += bone.position;
        output.position = float4(newPos, 1);
        output.normal = normalize(mul(output.normal, modelRotation));
        
        bone = bonesBuffer[bone.parent];
    }
```
Any assumptions made about the optimization need to be verified after implementing the changes. Running NVIDIA Nsight on the updated code confirms that the expected performance improvements were achieved.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/treeOpt/optimazedfirst.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div> 
</div>

The results clearly show that this change reduced the draw time from 177 ms to 67 ms (approximately 1.77 ms to 0.67 ms per mesh). In this implementation, we only support one transformation of tree.

<h2>Supporting various transformations</h2>
Trees will almost never have exactly the same rotation in order to create a more natural look in the game, even when reusing the same model. This adds some complexity to the implementation. While each tree can share the same model and skeleton data, each instance will need its own specialized rotation buffer to ensure correct bone rotations based on its unique orientation.
<br>
To achive this we only need to pass different model matrix to compute shader.

```cpp
// compute pass
{
    // bind compute pipeline
    for(auto& instance : instances)
    {
        shader->SetMatrix(index, &instance.matrix);
        Dispatch();
    }

    // submit work to GPU
}
```
This approach adds extra work to the compute pipeline, as each new model increases the amount of computation required. However, this increase is much smaller compared to the original implementation since the workload depends on the number of bones in the skeleton, not the number of vertices in the model.

Profiling shows that calculating the rotation matrices for all 100 different trees takes only about 0.38 ms.
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/treeOpt/computePass.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div> 
</div>

<h2>Specific changes</h2>
My tree model has exactly 4 bone levels. In this case, all joint indices can be packed into an index buffer using uint32, with each index occupying 8 bytes. These indices will be decoded on the GPU and used to apply rotations to the branches. An invalid index is represented by 0xff (255).

If all the rotation matrices are combined during traversal, the final rotation matrix can be used to calculate the vertex normals at the end.

```hlsl
    float3x3 finalRotation = float3x3(
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    );

    uint4 indicies;

    for (int i = 4; i > 0; i--)
    {
        if(indicies[i] == 0xff)
        {
            continue;
        }

        // calculate bend position
        float3x3 modelRotation = matricies[joint];

        bone = bonesBuffer[indicies[i]]
        
        // position relative to bone origin
        float3 branchPos = output.position.xyz - bone.position;
    
        float weight = clamp(length(branchPos) / bone.length, 0, 1);
        
        float3 newPos = mul(branchPos, modelRotation).xyz;
        newPos = lerp(branchPos, newPos, weight);
        newPos += bone.position;
        output.position = float4(newPos, 1);
    }

    output.normal = normalize(mul(output.normal, finalRotation));
```

<h2>Scaling for More Complex Skeletons</h2>
What can be done if, for some reason, a tree skeleton exceeds the current limit of 4 bones in the hierarchy? Based on previous experimentation, we can safely assume that bone data as position, direction, length, and parent ID are accessible. So, how can we leverage this data to scale for more complex skeletons?<br>

Since we’re already working with skeletal meshes, it’s also safe to assume that we have access to bone inverse matrices and bone weights.<br>

<h3>Is it Possible to Perform Skinning Like on a Regular Skeletal Mesh?</h3>
The answer is yes, but it’s not as straightforward as traditional skinning, which is usually performed on the CPU. Whether done on the CPU or GPU, the first step is to look at what information we currently have and what needs to be computed to obtain the final matrices for skinning.
<br>
For each bone, right now we have:
```hlsl
struct TreeBone
{
    float3 position; // model space position of bone
    float3 direction; // direction of bone
    uint levelParent; // lcombined bone level value (last 16 byts) and parent bone Id(first 16 byts)
    float length; // length of bone 
}
```

If we manage to properly calculate the skinning matrices, the length value is no longer needed. Previously, this length was used to calculate bone weights on vertices, but with proper skinning, those weights become essential and must be correctly applied.<br>

From the previous optimization, we already have a buffer containing all rotation matrices for all bones. This buffer can be stored either as rotation matrices or, for a lower memory footprint, as quaternions.
<br>
In theory, all the necessary data is already available. To correctly calculate the final bone matrices, we need all bone rotations, their positions, and the inverse bind matrices.

<h3>Small reminder:</h3> 
* All rotation matrices/quaternions are in local bone space.
* All bone positions are in model space.
To calculate the skinning matrices, we need to start from the root bone, update its skinning matrix, and then recursively update all child bones until reaching the end of the hierarchy.
<br>

Ideally, this entire operation should be performed on the GPU for three main reasons:
* Readback and update from CPU to GPU and back are expensive and slow.
* Keeping all data GPU-exclusive improves efficiency.
* The GPU’s parallel power is well-suited since each tree has unique matrices.

Goal on the GPU:
* To achieve this, two compute shaders will be used:
* One to perform rotation calculations (already discussed).

```
**************************    ***************************    ***********************
* Rotations Calculations * -> * Skinning Matricies Pass * -> * Skinning and Render *
**************************    ***************************    ***********************
```


First, we need to set up all the required data for this pass.<br> The inputs will include the bones’ hierarchy data, their rotations, and the inverse bind matrices. The output of this compute shader will be a buffer containing the final skinning matrices for each bone.

```hlsl
Pick bone from buffer
// performe this from root back to the bone
{
    flaot4x4 boneMatrix = (matrix4x4)0;
    // start from root
    flaot3 postion = bone.position;
    float3x3 roation = bone.rotation;

    if(bone != rootBone)
    {
        // we need local postion
        position -= bone.parent.postion;
    }

    // create local matrix
    float4x4 localMatrix = float4x4(
                rotation[0], 0,
                rotation[1], 0,
                rotation[2], 0,
                position.x, position.y, position.z, 1
            );

    if(bone != rootBone)
    {
        boneMatrix = local;
    }
    else
    {
        boneMatrix = mul(boneMatrix, localMatrix);
    }
}

// to move it to proper pose
boneMatricies[boneIndex] = boneMatrix * inverseMatricies;
```

We can optimize this by precalculating the local positions of the bones.<br>

However, performing this on the GPU brings challenges that would normally be easier to handle on the CPU. Let’s go over these challenges:
* Bone depth: The depth of bones in the hierarchy is unpredictable.
* Repeated calculations: Parent bones may be recalculated multiple times.
<br>
On the CPU, a common solution is to start at the root bone and traverse all children in a hierarchical order, avoiding recomputation of parent bones and handling depth naturally. This approach is not feasible on the GPU, where handling variable-depth hierarchies is generally very difficult without imposing an upper limit on bone depth. Specifying such a limit makes the problem solvable.<br>
Regarding repeated parent bone calculations, this is arguably unsolvable in the current state. When dispatching compute shaders, the GPU launches many threads organized in thread groups. While threads within a group can share memory, sharing memory across thread groups is not possible, making reuse of parent calculations across groups difficult.

After implementing this solution, I found it did not provide a significant benefit in my case because my tree rig only had 4 bone levels (root → level 1 → level 2 → level 4). This was more of an experiment to test what’s possible. The situation might be different for models with higher complexity or more bone levels.<br>

A small advantage of this approach is that you can reuse the same skeleton shader code for deferred and forward rendering paths.

<h2>Conclusion</h2>
Depending on your game’s needs, implementing either a one-pass or two-pass optimization can be beneficial for your game or game engine.<br>

* If you don’t mind writing separate shaders specifically for trees, the one-pass approach is a good option.

* If you have more GPU memory available and prefer to avoid writing additional shaders for trees, the two-pass approach is the better choice.

In terms of memory usage, the two-pass method is more demanding, requiring one extra buffer per rig and one additional buffer per instance for skinning.