---
layout: post
title: Procedural Wind Tree Animations
description: GPU procedural wind animation inspired from Ghost of tsushima and God of War
data : 2025-1-22
tags: GPU programming DirectX12
categories: GPU programming DirectX12
---

<h1>
GPU Dynamic Wind Tree Animations
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
<br><br>
<h3> Bending </h3>
In Ghost of Tsushima, a more complex and asset dependent technique is used for simulating wind effects, specifically through bending. This approach relies on model/asset, requiring a skeletal mesh with a properly rigged skeleton. In contrast, the stretching technique, which is more flexible and can be applied to any static mesh without the need for additional rigging. While bending offers more realistic and detailed wind interactions, it comes with increased complexity and asset requirements.
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
Branch it this categry will be pressed down. Combination of draw and lift will produce some swaying up and down.
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
To Simplify the the model/asset rigging process, we can use one bone ber entire branch level. As explained simulating wind like motion uses skeleton rig only to represnet hierarchi of ranches and relationship between branch and vertex. It can be assumed that one bone per branch level can be used to simplify the rigging process.
<br>
We can Also ommit the weight of on the branch itself, if we add extra bone to specify the branch length. This bone would be ommited in simulation. The length property would be added to the bone data. Final branch weight can e calculated on GPU from bone data.
<br>
Final bone struct used in shader
```hlsl
struct Bone
{
    float3 origin; // position in modle space of branch origin(bone position)
    float length; // length of the bone, precomputed on CPU
    uint parent; // id of parrent bone, could be replcaed with limited number of bone per vertex
}
```
Function to calculate bend weight from branch bone and model space position of vertex
```hlsl
float CalculateBoneWeight(Bone bone, float3 position)
{
    float3 localPos = position - bone.Posiion; // local position in branch space
    float localDist = length(localPos) / bone.lenght; // normalized branch weight 
    return clamp(localDist, 0,1); // clamping value to range [0,1], in case we go over 1
}
```
<h4> Branch simulation step</h4>

```hlsl
float4 bendBranch(float3 pos, float3 branchOrigin, float3 branchUp,
                  float branchNoise, float3 windDir, float windPower)
{
    // position in branch space
    float3 branchSpacePos = pos - branchOrigin;

    // calculating wind amount values
    float towardsX = dot(normalize(float3(posInBranchSpace.x, 0, posInBranchSpace.z)), float3(1, 0, 0));
    float facingWind = dot(normalize(float3(posInBranchSpace.x, 0, posInBranchSpace.z)), windDir);
    float a = branchSwayPowerA * cos(time + branchNoise * branchMovementRandomization);
    float b = branchSwayPowerB * cos(timeWithDelay + branchNoise * branchMovementRandomization);
    
    // rotation ammount for wind facing branch
    float oldA = a;
    a = -0.5 * a + branchSuppressPower * branchSwayPowerA;
    a = lerp(oldA * windPower, a * windPower,
           delayedWindPower * saturate(1 - facingWind));
    
    // opposite wind side ammount
    b *= windPower;

    // creating wind tangent to create axies for wind facing branch
    float3 windTangent = float3(-windDir.z, windDir.y, windDir.x);
    
    // rotation facing the wind
    float4 rotation1 = quatAxisAngle(windTangent, a);

    // rotaion oposite to the wind
    float4 rotation2 = quatAroundY(b);
    
    // lerping final position between 2 rotaions based on angle between branch and wind
    return lerp(rotation1, rotation2, 1 - abs(facingWind));
}
```