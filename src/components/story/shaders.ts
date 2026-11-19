import { EASE_GLSL } from "@/lib/particle-kit";

/**
 * One draw call for the whole story. Every dot knows where it is in the shape being left
 * (`From`) and in the shape being arrived at (`To`); `uMix` moves it between the two.
 */
export const vertexShader = /* glsl */ `
  uniform float uMix;
  uniform float uTime;
  uniform float uTurn;        // the story's own clock: it slows while something is hovered
  uniform float uIntro;
  uniform float uSpinFrom;
  uniform float uSpinTo;
  uniform vec4 uWaveFrom;     // speed, bands, strength, flicker
  uniform vec4 uWaveTo;
  uniform float uLumFrom;     // 1 where dot size follows aParam (the portrait)
  uniform float uLumTo;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uCursor;       // in the cloud's own space
  uniform vec3 uCursorVel;
  uniform float uCursorAmt;
  uniform float uHotGroup;
  uniform float uHotAmt;
  uniform float uStreak;      // scroll speed, about -1.5 to 1.5
  uniform float uAudio;
  uniform float uFocus;       // distance from the camera that is sharp
  uniform float uReveal;      // portrait chapter: the cursor clears dots off the photo
  uniform float uReach;       // how much further back the camera stands on a narrow screen

  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aParamFrom;
  attribute float aParamTo;
  attribute float aGroupFrom;
  attribute float aGroupTo;
  attribute vec3 aTurnFrom;   // axis x, axis y, radians per second (the gears)
  attribute vec3 aTurnTo;
  attribute vec3 aSeed;

  varying float vAlpha;
  varying float vGlow;
  varying float vSeed;

  ${EASE_GLSL}

  const float TAU = 6.2831853;

  vec3 aroundY(vec3 p, float angle) {
    float c = cos(angle), s = sin(angle);
    return vec3(p.x * c + p.z * s, p.y, p.z * c - p.x * s);
  }

  // Turns a dot around its own gear's axle.
  vec3 aroundAxle(vec3 p, vec3 turn) {
    float angle = turn.z * uTurn;
    float c = cos(angle), s = sin(angle);
    vec2 d = p.xy - turn.xy;
    return vec3(turn.xy + vec2(d.x * c - d.y * s, d.x * s + d.y * c), p.z);
  }

  // Narrow bright bands that travel along the shape.
  float band(float param, vec4 wave) {
    return wave.z * pow(0.5 + 0.5 * sin((param * wave.y - uTime * wave.x) * TAU), 12.0);
  }

  float flicker(float param, vec4 wave) {
    float level = 0.5 + 0.5 * sin(uTime * 1.3 + aSeed.y * 30.0 + param * 8.0);
    return mix(1.0, smoothstep(0.15, 0.85, level), wave.w);
  }

  void main() {
    vec3 away = normalize(aSeed * 2.0 - 1.0 + 0.0001);

    // Each dot leaves at its own moment and swings outward on the way.
    float t = easeInOut(clamp((uMix - aSeed.x * 0.3) / 0.7, 0.0, 1.0));
    vec3 from = aroundY(aroundAxle(aFrom, aTurnFrom), uSpinFrom);
    vec3 to = aroundY(aroundAxle(aTo, aTurnTo), uSpinTo);
    vec3 pos = mix(from, to, t) + away * sin(t * 3.14159) * (1.5 + aSeed.y * 2.5);

    // Never quite still; livelier with the music.
    pos += away * (0.04 + uAudio * 0.22) * sin(uTime * 1.7 + aSeed.z * TAU);

    // The cursor parts the dots and drags them along with it.
    vec3 fromCursor = pos - uCursor;
    float near = smoothstep(2.4, 0.0, length(fromCursor)) * uCursorAmt;
    pos += normalize(fromCursor + 0.0001) * near * (0.9 + uReveal * 1.6) + uCursorVel * near * 0.8;

    // The hovered group buzzes.
    float group = t < 0.5 ? aGroupFrom : aGroupTo;
    float hot = (1.0 - step(0.1, abs(group - uHotGroup))) * step(-0.5, group) * uHotAmt;
    pos += away * hot * 0.06 * sin(uTime * 9.0 + aSeed.x * 40.0);

    // First gathering: from far out in every direction.
    pos = mix(away * (14.0 + aSeed.y * 12.0), pos, uIntro);

    float glow = mix(band(aParamFrom, uWaveFrom), band(aParamTo, uWaveTo), t)
      + near * 0.7 * (1.0 - uReveal) + hot * 1.2;
    float visible = mix(flicker(aParamFrom, uWaveFrom), flicker(aParamTo, uWaveTo), t);
    float byLum = mix(
      mix(1.0, 0.25 + aParamFrom * 1.4, uLumFrom),
      mix(1.0, 0.25 + aParamTo * 1.4, uLumTo),
      t
    );

    vec4 view = modelViewMatrix * vec4(pos, 1.0);
    // Fast scrolling smears the cloud: every dot lags by its own amount.
    view.y += uStreak * (0.15 + aSeed.y * 1.1);
    float depth = -view.z;
    gl_Position = projectionMatrix * view;

    // Depth of field: dots away from the focus distance get bigger and fainter.
    float blur = clamp(abs(depth - uFocus) / uFocus, 0.0, 1.5);
    gl_PointSize = uSize * (0.55 + aSeed.z * 0.9) * byLum * (1.0 + blur * 1.6) * (1.0 + glow * 0.9)
      * uPixelRatio / max(depth, 0.5);

    vAlpha = visible * (1.0 - near * uReveal * 0.95) / (1.0 + blur * 2.2)
      * smoothstep(48.0 * uReach, 12.0 * uReach, depth) * smoothstep(0.3, 2.0, depth) * (0.35 + 0.65 * uIntro);
    vGlow = glow;
    vSeed = aSeed.x;
  }
`;

export const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uBloom;

  varying float vAlpha;
  varying float vGlow;
  varying float vSeed;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = clamp(vGlow, 0.0, 1.5);
    vec3 color = mix(uColor, uAccent, min(glow, 1.0) * 0.8);
    // A few dots in every hundred are always the accent colour.
    color = mix(color, uAccent, step(0.985, vSeed));
    // With the bloom pass on, only what is hovered or under the cursor goes far enough over 1
    // to bloom: the travelling bands stay flat colour, or every shape would wash out to white.
    color *= mix(1.0, 0.82 + glow * 0.4 + max(glow - 1.0, 0.0) * 1.6, uBloom);
    gl_FragColor = vec4(color, smoothstep(0.5, 0.15, d) * vAlpha * (0.75 + min(glow, 1.0) * 0.25));
  }
`;
