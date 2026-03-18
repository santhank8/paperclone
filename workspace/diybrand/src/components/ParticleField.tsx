"use client";

import { useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

export function ParticleField() {
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    if (window.innerWidth < 768) return;

    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  if (isMobile || !ready) return null;

  return (
    <Particles
      id="tsparticles"
      className="pointer-events-none fixed inset-0 z-0"
      options={{
        fullScreen: false,
        fpsLimit: 60,
        particles: {
          number: { value: 40, density: { enable: true } },
          color: {
            value: ["#8b5cf6", "#f72585", "#00f5ff", "#a8ff3e"],
          },
          opacity: {
            value: { min: 0.1, max: 0.4 },
            animation: { enable: true, speed: 0.5, sync: false },
          },
          size: {
            value: { min: 1, max: 3 },
          },
          move: {
            enable: true,
            speed: 0.6,
            direction: "none",
            outModes: "bounce",
          },
          links: {
            enable: true,
            distance: 150,
            color: "#8b5cf6",
            opacity: 0.1,
            width: 1,
          },
        },
        interactivity: {
          events: {
            onHover: { enable: true, mode: "grab" },
          },
          modes: {
            grab: { distance: 200, links: { opacity: 0.3 } },
          },
        },
        detectRetina: true,
      }}
    />
  );
}
