"use client";

/**
 * The ring of text around the particle medal in the About section. While it is hovered the
 * medal swells towards the text: the seal (a section component) sets the flag, the particle
 * cloud (components/fx/ParticleMorph) reads it every frame.
 */
export const seal = { hovered: false };
