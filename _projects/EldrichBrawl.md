---
layout: page
title: Eldrich Brawl
description: LAN coop game
img: assets/img/EB/main_screen.png
importance: 4
category: fun
---

Eldritch Brawl is a local co-op party game inspired by Gang Beasts and TowerFall, designed for 2 to 4 players. Each match begins with players spawning at random locations within a chaotic, fast-paced arena. To gain the upper hand, players must pick up various items. All items can be thrwed, hitting opponent temporarily stun them.
<br>
Once an opponent is stunned, they become vulnerable, allowing other players to carry them to altar located in the middle of the arena. Sacrificing a stunned player at the altar grants points, and the first player to accumulate 10 points wins the match.
<br><br>
* Multiplayer Support : 
To enable multiple players, the game utilizes Unity’s New Input System, which features automatic input detection. When a new input is detected, the system dynamically creates a new player and asign device to them. Each player is instantiated based on a predefined player prefab.
<br><br>
* Character outlines : Since players can choose from four different characters, a shader-based outline effect was implemented to help distinguish them more easily during gameplay. This effect was created using Unity’s Shader Graph. The outline is achieved by offsetting the character's sprite in eight directions and multiplying it by a specified outline color. The original sprite is then rendered on top, preserving its details while maintaining clear visibility for each player.
<br><br>
* Level system : To minimize downtime between rounds and keep players engaged, a custom level management system was developed. While switching between scenes—even asynchronously—introduces delays, keeping multiple scenes active simultaneously would significantly increase code complexity and make overall scene management unnecessarily complicated.
<br>
Instead, a dedicated level scene was created, containing only a Level Manager responsible for handling level transitions. Pre-made levels are stored as prefabs, which are dynamically spawned by the Level Manager at the start of each round. These level prefabs manage their own round mechanics, and once a round or game ends, the Level Manager seamlessly switches to the next level prefab without requiring a full scene reload.
<br><br>
* Asyncronous level loading : To ensure smooth transitions between the menu, levels, and back, Unity’s asynchronous scene loading system was utilized. The game starts in an empty scene containing a Global Scene Manager, which is responsible for handling scene loading, unloading, and managing transitions.
<br>
To enhance the player experience during load times, simple loading screens featuring character lore were added. These not only provide insight into the game's world but also keep players engaged while waiting for the next scene to load.

<a href="https://github.com/MirecChillec/PartyGame">source</a><br>
<a href="https://levelup-official.itch.io/eldrich-brawl">itch</a>
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include video.liquid path="assets/video/EB/game.mp4" class="img-fluid rounded z-depth-1" controls=true %}
    </div>
</div>
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/EB/PfXCRK.png" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/EB/TxHjHA.png" title="example image" class="img-fluid rounded z-depth-1" %}
    </div>
</div>