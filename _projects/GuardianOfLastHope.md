---
layout: page
title: Guardian of Last Hope
description: Hack and slash combat game
img: assets/img/GOLH/start screen.png
importance: 5
category:  Side Project / school
---

Embrace the fight against darkness in Guardian of Last Hope, a fast-paced hack-and-slash game featuring devastating special abilities and a powerful companion. Wield your trusty sword and harness the strength of your companion to eliminate the monsters of darkness.
<br>
Fight with Strategy and Power
Your companion grants you a variety of abilities, allowing you to strategize and unleash powerful attacks. However, their energy fuels both their abilities and your only light source in this shadowed world. Protect your companion at all costs—if they fall, the world will be consumed by darkness.
<br>
Unleash Devastating Abilities
* Group enemies together and deliver a final, crushing blow to take them all down at once.
* Disintegrate all enemies in sight with a powerful laser beam of light.
* Control the battlefield with an explosive burst of light, obliterating anything in its range.
<br>
Master your sword, harness your companion’s abilities, and become the last beacon of hope against the forces of darkness!

* A* Pathfinding : 
Unity does not provide a built-in solution for 2D pathfinding, so a free A pathfinding plugin* was integrated into the project. This allows for efficient navigation in a 2D space, enabling smooth enemy movement and AI behaviors.

* Companion Abilities : 
Both the explosion and laser beam abilities utilize Unity’s built-in 2D physics engine. These abilities detect enemies upon collision and apply damage accordingly, ensuring responsive and dynamic combat interactions.

* Enemy AI :
There are two main enemy types, each with distinct behaviors and attack patterns:
+ Chaser: Moves directly toward the player and attacks by shooting spikes in all directions while advancing.
+ Orbiter: Alternates between idle and attack states. In idle mode, it circles around the player. When attacking, it charges straight through the player before returning to its circling pattern.

<a href="https://levelup-official.itch.io/team-give-me-five-hra-guardian-of-the-last-hope">itch</a>
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include video.liquid path="assets/video/GOLH/game.mp4" class="img-fluid rounded z-depth-1" controls=true %}
    </div>
</div>
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/GOLH/+RHgI4.png" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/GOLH/t.png" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
</div>