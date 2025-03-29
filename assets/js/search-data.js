// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-blog",
          title: "blog",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/blog/";
          },
        },{id: "nav-projects",
          title: "projects",
          description: "A growing collection of your cool projects.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/projects/";
          },
        },{id: "nav-cv",
          title: "cv",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "post-procedural-wind-tree-animations",
      
        title: "Procedural Wind Tree Animations",
      
      description: "GPU procedural wind animation inspired from Ghost of tsushima and God of War",
      section: "Posts",
      handler: () => {
        
          window.location.href = "/blog/2025/WindTrees/";
        
      },
    },{id: "projects-aneemate",
          title: 'AneeMate',
          description: "extraction shooter",
          section: "Projects",handler: () => {
              window.location.href = "/projects/Annemate/";
            },},{id: "projects-cpu-raytracer",
          title: 'CPU raytracer',
          description: "CPU whited raytracer",
          section: "Projects",handler: () => {
              window.location.href = "/projects/CPURaytracer/";
            },},{id: "projects-citizen-conflict",
          title: 'Citizen Conflict',
          description: "arena hero shooter / battle royale",
          section: "Projects",handler: () => {
              window.location.href = "/projects/CitizeCondlict/";
            },},{id: "projects-eldrich-brawl",
          title: 'Eldrich Brawl',
          description: "LAN coop game",
          section: "Projects",handler: () => {
              window.location.href = "/projects/EldrichBrawl/";
            },},{id: "projects-guardian-of-last-hope",
          title: 'Guardian of Last Hope',
          description: "Hack and slash combat game",
          section: "Projects",handler: () => {
              window.location.href = "/projects/GuardianOfLastHope/";
            },},{id: "projects-pbr-renderer",
          title: 'PBR renderer',
          description: "a project that redirects to another website",
          section: "Projects",handler: () => {
              window.location.href = "/projects/PBRrenderer/";
            },},{id: "projects-soul-maze",
          title: 'Soul Maze',
          description: "3D cooperative packman",
          section: "Projects",handler: () => {
              window.location.href = "/projects/SoulMate/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%65.%6B%65%63%6B%65%73%38@%67%6D%61%69%6C.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/erikkeckes", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/erik-keckes-b781b2254", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
