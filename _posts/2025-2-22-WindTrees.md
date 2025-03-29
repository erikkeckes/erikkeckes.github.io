---
layout: post
title: Procedural Wind Tree Animations
description: GPU procedural wind animation inspired from Ghost of tsushima and God of War
data : 2025-1-22
tags: GPU programming DirectX12
categories: GPU programming DirectX12
---

<h1>
GPU procedural Wind Tree Animations
</h1>

Wind can significantly enhance immersion while exploring a game's environment by adding a sense of movement and realism. It brings the 3D world to life by dynamically affecting elements such as trees, grass, and water, making the environment feel more responsive and engaging. Additionally, wind can amplify the intensity of storms, large-scale battles, or other impactful events by influencing visual effects, generating sound waves, and creating a more dramatic atmosphere. This not only deepens the player's sense of presence but also reinforces the overall mood and storytelling of the game.

<h2>Simulation problems</h2>
Simulating physicly correct wind is extremly computational expensive so we only simulate the visuals aspect of this simulation. From observations of the win in nature tree motions created by wind fields are chaotic. So instead of of proper simulation we only aproximate.
<br>
To simplify the aproximation calculation wind can be defined as directional vector 2D/3D and wind power.
<h2>
Technicues used to create wind animations
</h2>
Ghost of tsushima and God of War booth simulate wind and wind animations on various objects in the game world. Booth use different technique to achieve wind effects on mesheses.

These techniques try to aproximate tree wind like motion : 
* Stretching
* Bending
<h3> Stretching </h3>
This technique is used in God of War to simulate wind effects on meshes. It is a relatively simple method that provides a wind like motion while maintaining a high degree of customizability for each instance. <br>
Additionally, it does not have any special requirements on models/assets, making it a flexible and efficient approach for integrating wind effects into a game environment.
<br>
Creating a wind effect using this approach is relativly easy. First length of position in model space is calculated. Wind is applied to position, streatching the model. To create more natural look we adjust new position by adjusting the directional vector based on length of original position.

```hlsl
float3 StretchPosition(float3 position, float3 windDirection, float windPower)
{
    // leng of original of original position
    float originalLength = length(position);
    // stretching position using wind
    float3 newPosition = position + windDirection * windPower;
    // adjusting position based on original length
    newPosition = normalize(newPosition) * originalLength;
    return newPosition;
}
```
This forms the core of the algorithm. On its own, it would move the entire model without any wind bending or curvature. To simulate the effect of wind, a wind weight can be calculated and used to modify the wind power. This ensures that vertices farther from the pivot point are more affected. Proper calculation of the model's total height is necessary for accurate wind influence distribution.

```hlsl
float3 StretchPosition(float3 position, float3 windDirection, float windPower, float3 vertexColor)
{
    // leng of original of original position
    float originalLength = length(position);
    float weight = originalLength / modelHeight;
    // stretching position using wind
    float3 newPosition = position + windDirection * windPower * weigth;
    // adjusting position based on original length
    newPosition = normalize(newPosition) * originalLength;
    return newPosition;
}
```
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/stretchin1.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
    </div>
</div>

To introduce curvature, a Bézier curve can be used. The vertex weight is calculated and then used to determine the final modifier (ranging from 0 to 1, similar to weights) for stretching.
```hlsl
float3 StretchPosition(float3 position, float3 windDirection, float windPower, float3 vertexColor)
{
    // leng of original of original position
    float originalLength = length(position);
    float weight = originalLength / modelHeight;
    // stretching position using wind
    float3 newPosition = position + windDirection * windPower * SampleBezierCurve(weight).y * weigth;
    // adjusting position based on original length
    newPosition = normalize(newPosition) * originalLength;
    return newPosition;
}
```
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/stretchin2.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
    </div>
</div>

Periodic function like sin and cos can be used to create periodic waving.
```hlsl
float3 StretchPosition(float3 position, float3 windDirection, float windPower, float3 vertexColor)
{
    // leng of original of original position
    float originalLength = length(position);
    float weight = originalLength / modelHeight;
    // stretching position using wind
    float phase = (cos(time) + 1) * 0.5;
    float3 newPosition = position + windDirection * (windPower + windPower * phase) * weigth * SampleBezierCurve(weight).y;
    // adjusting position based on original length
    newPosition = normalize(newPosition) * originalLength;
    return newPosition;
}
```
{% include video.liquid path="assets/video/WindAnim/Stretching.mp4" class="img-fluid rounded z-depth-1" controls=true %}

Artists can be given greater creative freedom by introducing several adjustable parameters to the wind simulation function. These parameters can control aspects such as stretching, stiffness, modifications to noise functions, and other properties that influence how the wind affects different parts of the mesh. This level of customization allows for fine-tuning the movement of vegetation, cloth, or other objects affected by wind, making the simulation feel more natural and responsive.

The algorithm is highly customizable, enabling a wide range of effects tailored to different assets. In God of War, for example, the wind system supports up to eleven parameters per mesh, giving artists extensive control over how individual objects react to wind forces. This approach provides a balance between realism and performance while maintaining flexibility for artistic expression.
<h3> Bending </h3>
In Ghost of Tsushima, a more complex and asset dependent technique is used for simulating wind effects, specifically through bending. This approach relies on model/asset, requiring a skeletal mesh with a properly rigged skeleton. In contrast, the stretching technique, which is more flexible and can be applied to any static mesh without the need for additional rigging. While bending offers more realistic and detailed wind interactions, it comes with increased complexity and asset requirements.
<br><br>
This technique uses quanternions to apply rotation. 
<br><br>
In this technique, the skeleton is used to represent individual branches of the tree. The skeletal hierarchy naturaly organize the bones in branch hierarchy. The root bone of the skeleton represents the trunk, while its direct children correspond to the first level of branches. This branching structure continues further, with each subsequent level representing smaller branches. Depending on the complexity of the tree, the number of levels can vary, but typically, 2 to 4 levels (excluding the trunk) are sufficient to achieve visually appealing results.
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/BranchesH.jpg" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
    </div>
</div>
<h4>Trunk motion</h4>
Trunk motion is mainly a result of the drag forces applied to braches connected to the trunk.
To simulate the trunk motion we would need to simulate all branches and propage the result of the simulation all the way down to the trunk.
<br>
All calculations are running on GPU, which takes advantage of parallelizm. This aproach is hard to simulate all branches fist before simulating the trunk motion, mainly on GPU. Also this approach results in chaotic motion.
<br>
First we need to take into account that trunk motion is affected by many factors except drag force. These are stiffnes, branch distribution, mass ,inertia and wind turbolance(to avaid too synchronous movement).
We can combine all of them into one function.
```
m a(t) + c v(t) + k x(t) = f(t)
```
m - mass<br>
c,k - damping<br>
f - force<br>
a - linear acceleration<br>
v - linear velocity<br>
x - position of branch<br>

<h4>Branch motion</h4>
We could simulate branch motion purely based on drag forces. This apraoch doesn't fit trees perfectly sonce aerodamics of leafs(shape dependant) can cause some lift of the braches. Lift can be defiend as sum of all external forces on a body acting perpendicular to the direction of the flow.
<br>
Branches can be separated into tree categories:
* branch on wid facing side of tree
* brach is on opposite side of tree
* branch is perpendicular to wind direction
<br>
<h5>Wind facing side</h5>
Branch it this categry will be pressed down. Combination of drag and lift will produce some swaying up and down.
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/windface.jpg" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
    </div>
</div>
<h5>Oposite Side</h5>
Branch on opposite side, will be highly affected by wind turbolance and lift. This will result in high amplitude motion, such as random swaying or flapping.
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/oppositeSide.jpg" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
    </div>
</div>
<h5>Perpendicular to wind</h5>
Brach perppendicular to wind will have a strong drag force aplied. Angle of the branch will cause it to bend around it's parent branch axies. Lift will bend it around it's own axies.
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/Perppendicular.jpg" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>    
    <div class="col-sm mt-3 mt-md-0">
    </div>
</div>

Final result may be unnaturally synchronous. To improve it we can add optional parameters to the branches. Branch specific stiffness and oscilation offsets can be used to create assynchrous motion.
If we know the level of branch we can take into account that as well and make oscilation differences between branch levels.
<h4>Rigging simplification</h4>
To simplify the model/asset rigging process, we can use a single bone per branch level. As explained, simulating wind-like motion relies on a skeletal rig to represent the branch hierarchy and the relationship between branches and vertices. By assuming one bone per branch level, the rigging process becomes more straightforward.
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/Levels.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>    
    <div class="col-sm mt-3 mt-md-0">
    </div>
</div>
Additionally, we can omit the weight on the branch itself by introducing an extra bone to define the branch length. This additional bone would be excluded from the simulation, with its length property stored in the bone data. The final branch weight can then be computed on the GPU using the bone data.
<br>
Example bone struct used in shader
```hlsl
struct Bone
{
    float3 origin; // position in modle space of branch origin(bone position)
    float3 direction; // direction of the bone
    float length; // length of the bone, precomputed on CPU
    uint parent; // id of parrent bone, could be replcaed with limited number of bone per vertex
}
```
Function to calculate bend weight from branch bone and model space position of vertex. This can be replaced with traditional weights, depending on use case.
```hlsl
float CalculateBoneWeight(Bone bone, float3 position)
{
    float3 localPos = position - bone.Posiion; // local position in branch space
    float localDist = length(localPos) / bone.lenght; // normalized branch weight 
    return clamp(localDist, 0,1); // clamping value to range [0,1], in case we go over 1
}
```
If artists want more control, bone weights can be added. Another improvement is precomputing all bones that influence a branch instead of traversing the branch hierarchy based on bone indices in the shader.

<h4> Branch simulation step</h4>
Branches simulate bending by traversing the branch hierarchy to the trunk. Simulation step is executed for each branch level
<br>
Each bending rule is defined by its own amplitude, frequency, and angle shift, allowing for diverse movement patterns. These parameters can be individually customized for each tree instance, enabling unique bending behavior across different trees. By adjusting these values, variations in amplitude, angle shift and frequenceis can be introduced, enhancing the realism and diversity of tree animations in a scene.

```hlsl
float3 BendBranch(float3 localPos, Bone bone, float weight, float3 windDir, float3 windTangent)
{
	// determine branch orientation relative to the wind
	float dota = dot(bone.direction, windDir);
	float dotb = dot(bone.direction, windTangent);

	// calculate parameters for rules
	float t = dota * 0.5f + 0.5f;
	float3 amplitudes = lerp(BACKAMPLITUDE, FRONT_AMPLITUDE, t);
	float3 angleShifts = lerp(BACKAMPLITUDE, FRONT_AMPLITUDE, t);
	
	float amplitude0 = lerp3(amplitudes.x, amplitudes.y, amplitudes.z, weight);
	float angleShift0 = lerp3(angleShifts.x, angleShifts.y, angleShifts.z, weight);

	float frequency0 = (dota > 0)? FRONT_FREQUENCY: FREQUENCY_BACK;
	
	float amplitude1 = SIDE_AMPLITUDE.y;
	float angleShift1 = SIDE_ANGLESHIFT.y * dotb;
	float frequency1 = SIDE_FREQUENCY;
	
	// rotation along direction of the wind
	float4 q0 = quatAxisAngle(windTangent, angleShift0 + amplitude0 * sin((fTime)*frequency0));

	// rotation along the trunk
	float4 q1 = quatAxisAngle(getTrunkAxis(), angleShift1 + amplitude1 * sin((fTime)*frequency1));
	
	// combine bending
	float4 q = lerp(q1, q0, abs(dota));
	
	// convert quaternion to rotation matrix (3x3)
	float3x3 windRotationMatrix = quatToMatrix(q);
    // bend the local vector
    float3 newPos = ((pos - bone.origin) * windRotationMatrix).xyz;
    return newPos + bone.origin;
}
```

<h4>Putting all together</h4>
Bending simulations can be executed entirely in the vertex shader. Data retrieval for vertices varies depending on the renderer and rendering API used. This serves as an example of a bending algorithm: initially, all data is fetched. Precalculating the bone hierarchy depth can optimize the loop by eliminating the need to check if a bone is a trunk (has no parent ID). The algorithm proceeds through each branch level, simulating each level and combining all rotations. Finally, trunk rotation is applied, a step that remains consistent regardless of the branch level.

```hlsl
// input constants
WindData wind;

// bone buffer
Buffer<Bone> BoneBuffer;

VertexOutput main(ShaderInput input)
{
    float3 position = input.position;
    
    uint boneIndex = input.boneId;
    Bone bone = BoneBuffer[boneIndex];
    int level = bone.level;
    float weight = 0;
    // zero level is trunk
    for(int i = level; i > 0; i--)
    {
        weight = CalculateBoneWeight(position, bone);
        position = BendBranch(position ,bone, weight, wind.Direction, windTangent);
        bone = BoneBuffer[bone.parent];
    }
    // apply trunk rotation
    float3x3 windRotation = quatToMatrix(windRotation);
    weight = CalculateBoneWeight(position, bone);
    position = lerp(position, (pos * windRotation).xyz, weight);

    VertexOutput output;
    output.position = position;
    return output;
}
```

{% include video.liquid path="assets/video/WindAnim/finalBend.mp4" class="img-fluid rounded z-depth-1" controls=true %}

This method is highly customizable, allowing for a wide variety of tree animations by adjusting key parameters such as angle shift, amplitude, and frequency.
By fine-tuning these parameters, a diverse range of tree behaviors can be achieved, making the system adaptable to various environments and artistic styles.

<h3>Wind representation</h3>
Up until now, we have represented wind as a simple directional vector and wind power, which is an efficient but limited approach. While this method is straightforward, it doesn't account for the complex, varying behavior of wind across a larger environment, such as wind fields. 
<h4>Noise texture</h4>
To simulate these more dynamic wind effects, a noise texture can be introduced, creating a wind field. This texture would be sampled based on the tree's instance position and time, providing variation in the wind's direction and intensity across different areas.

Both worley  and Perlin noise can be used for this purpose, with Perlin noise offering smooth, continuous variations and worley  creating more sharp, cell-like patterns. Using noise functions adds complexity to the wind direction generation, allowing for more natural and varied wind interactions. Instead of performing real-time noise function calculations, this process can be simplified by using a pre-generated texture, which can be looped over for the same effect. This method efficiently replicates the randomness of wind fields, creating a more immersive and organic wind simulation.
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        Perlin noise
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/perlin.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>    
    <div class="col-sm mt-3 mt-md-0">
        worley noise
        {% include figure.liquid loading="eager" path="assets/img/WindAnim/worly.png" title="branches hierarchy" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

<h4>Fluid simulation</h4>
Fluid simulation can be used to simulate wind motion, offering one of the most complex solutions for creating realistic and dynamic wind behavior. This approach simulates the movement of air in a more detailed and physically accurate manner, but developing a performant fluid wind simulation is a highly challenging task. To improve the simulation's realism, it can be combined with a terrain height map, preventing the wind from moving directly into steep cliffs or unrealistic paths by accounting for the terrain's influence on airflow.
<br>
In Ghost of Tsushima, fluid simulation is employed to simulate wind, and this simulation is used to affect various elements in the game, such as particles influenced by wind, cloth movement, and tree behavior. By simulating the wind's interaction with these elements in a fluid manner, the game creates a highly immersive experience, where the wind feels alive and responsive to the environment. This approach adds a high level of realism but requires careful optimization to ensure the performance remains manageable.
<br><br>
sources : <br>
* <a href="https://www.youtube.com/watch?v=d61_o4CGQd8&t=715s">Ghost of Tsushima</a><br>
* <a href="https://www.youtube.com/watch?v=MKX45_riWQA&t=1333s">wind efect God of War</a><br>
* <a href="https://www.youtube.com/watch?v=dDgyBKkSf7A&t=1475s">wind simulation God of War</a><br>
* <a href="https://developer.nvidia.cn/gpugems/gpugems3/part-i-geometry/chapter-6-gpu-generated-procedural-wind-animations-trees">gpu gems 3</a>
