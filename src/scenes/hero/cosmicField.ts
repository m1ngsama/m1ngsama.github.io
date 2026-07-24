/**
 * Shared material-space field for every object born from the surface.
 *
 * The coordinates deliberately live in parameter space instead of world
 * space. This keeps the same scar, grain and density field attached while the
 * material changes scale and topology.
 */
export const cosmicFieldGLSL = /* glsl */ `
  const float COSMIC_PI = 3.141592653589793;
  const float COSMIC_TAU = 6.283185307179586;

  float cosmicSmoother(float edge0, float edge1, float value) {
    float x = clamp((value - edge0) / max(edge1 - edge0, 0.00001), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }

  float cosmicHash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  vec3 cosmicHash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
  }

  float cosmicNoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(cosmicHash31(i), cosmicHash31(i + vec3(1, 0, 0)), f.x),
          mix(cosmicHash31(i + vec3(0, 1, 0)), cosmicHash31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(cosmicHash31(i + vec3(0, 0, 1)), cosmicHash31(i + vec3(1, 0, 1)), f.x),
          mix(cosmicHash31(i + vec3(0, 1, 1)), cosmicHash31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  float cosmicFbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      value += cosmicNoise3(p) * amplitude;
      p = p * 2.03 + vec3(7.13, 3.71, 5.17);
      amplitude *= 0.5;
    }
    return value;
  }

  float cosmicRidgedFbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int octave = 0; octave < 3; octave++) {
      float ridge = 1.0 - abs(cosmicNoise3(p) * 2.0 - 1.0);
      value += ridge * ridge * amplitude;
      p = p * 2.17 + vec3(4.7, 8.3, 2.9);
      amplitude *= 0.47;
    }
    return value;
  }

  float cosmicWorley(vec3 p) {
    vec3 cell = floor(p);
    vec3 local = fract(p);
    float nearest = 8.0;
    for (int z = -1; z <= 1; z++) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 neighbour = vec3(float(x), float(y), float(z));
          vec3 feature = cosmicHash33(cell + neighbour);
          nearest = min(nearest, length(neighbour + feature - local));
        }
      }
    }
    return nearest;
  }

  vec3 cosmicMaterialCoordinate(vec2 parameter) {
    float angle = parameter.x * COSMIC_TAU;
    float halfAngle = parameter.x * COSMIC_PI;
    float nonOrientableWidth = parameter.y * cos(halfAngle)
      + parameter.y * sin(halfAngle) * 0.43;
    float topology = cosmicSmoother(0.39, 0.535, uProgress);
    return vec3(cos(angle), sin(angle), mix(parameter.y, nonOrientableWidth, topology));
  }

  float cosmicMaterialField(vec2 parameter) {
    vec3 material = cosmicMaterialCoordinate(parameter);
    return cosmicFbm(material * vec3(1.35, 1.35, 1.1) + vec3(2.3, 5.1, 7.7));
  }

  float cosmicMaterialRidges(vec2 parameter) {
    vec3 material = cosmicMaterialCoordinate(parameter);
    return cosmicRidgedFbm(material * vec3(3.2, 3.2, 2.4) + vec3(11.1, 3.7, 5.2));
  }

  float cosmicCraterMetric(vec2 parameter) {
    vec3 material = cosmicMaterialCoordinate(parameter);
    return cosmicWorley(material * vec3(7.2, 7.2, 5.4) + vec3(8.2, 2.6, 4.4));
  }

  float cosmicPhaseDelay(vec2 parameter) {
    float front = sin(parameter.x * COSMIC_TAU + parameter.y * 0.82);
    float scar = sin(parameter.x * COSMIC_TAU * 2.0 + parameter.y * 1.7);
    return front * 0.009 + scar * 0.004 + abs(parameter.y) * 0.003;
  }

  void cosmicPhases(
    vec2 parameter,
    out float veil,
    out float planet,
    out float orbit,
    out float galaxy,
    out float horizon
  ) {
    float delay = cosmicPhaseDelay(parameter);
    float toPlanet = cosmicSmoother(0.105 + delay, 0.295 + delay, uProgress);
    float toOrbit = cosmicSmoother(0.39 + delay * 0.72, 0.535 + delay * 0.72, uProgress);
    float toGalaxy = cosmicSmoother(0.565 + delay * 0.44, 0.745 + delay * 0.44, uProgress);
    float toHorizon = cosmicSmoother(0.865 + delay * 0.2, 0.98 + delay * 0.2, uProgress);
    veil = 1.0 - toPlanet;
    planet = toPlanet * (1.0 - toOrbit);
    orbit = toOrbit * (1.0 - toGalaxy);
    galaxy = toGalaxy * (1.0 - toHorizon);
    horizon = toHorizon;
  }

  vec3 cosmicVeilSurface(vec2 parameter) {
    float x = (parameter.x - 0.5) * mix(8.8, 7.4, uMobile);
    float y = parameter.y * mix(2.85, 3.35, uMobile);
    float radius = length(vec2(x * 0.56, y));
    float gravity = exp(-radius * 1.28);
    float z = -1.05 + cos((parameter.x - 0.5) * COSMIC_PI) * 0.48;
    z -= gravity * (0.16 + cosmicSmoother(0.05, 0.22, uProgress) * 0.7);
    z += sin(parameter.x * COSMIC_PI * 4.0 + parameter.y * 1.7) * 0.075;
    return vec3(x, y, z);
  }

  vec3 cosmicPlanetSurface(vec2 parameter) {
    float longitude = parameter.x * COSMIC_TAU + 0.42;
    float latitude = parameter.y * COSMIC_PI * 0.5;
    float latitudeRadius = cos(latitude);
    return 2.05 * vec3(
      latitudeRadius * cos(longitude),
      sin(latitude),
      latitudeRadius * sin(longitude)
    );
  }

  vec3 cosmicMobiusSurface(vec2 parameter) {
    float theta = parameter.x * COSMIC_TAU;
    float halfTheta = theta * 0.5;
    float width = parameter.y * 0.58;
    float radius = 2.14;
    return vec3(
      (radius + width * cos(halfTheta)) * cos(theta),
      (radius + width * cos(halfTheta)) * sin(theta),
      width * sin(halfTheta)
    );
  }

  vec3 cosmicGalaxySurface(vec2 parameter) {
    float theta = (parameter.x * 1.68 + 0.035) * COSMIC_TAU;
    float radius = 0.2 + pow(parameter.x, 0.68) * 3.05;
    float taper = mix(0.135, 0.018, pow(parameter.x, 0.58));
    float ribbon = parameter.y * taper;
    float r = radius + ribbon;
    float z = parameter.y * mix(0.16, 0.035, parameter.x);
    z += sin(theta * 0.52 + uTime * 0.045) * 0.04 * (1.0 - parameter.x);
    return vec3(cos(theta) * r, sin(theta) * r, z);
  }

  vec3 cosmicHorizonSurface(vec2 parameter) {
    float theta = parameter.x * COSMIC_TAU;
    float halfTheta = theta * 0.5;
    float width = parameter.y * 0.023;
    float radius = 2.16;
    return vec3(
      (radius + width * cos(halfTheta)) * cos(theta),
      (radius + width * cos(halfTheta)) * sin(theta),
      width * sin(halfTheta)
    );
  }

  vec3 cosmicTransport(vec3 from, vec3 to, float amount, float lift, vec3 bias) {
    vec3 linear = mix(from, to, amount);
    vec3 radial = normalize(mix(normalize(from + vec3(0.001)), normalize(to + vec3(0.001)), amount));
    float arc = sin(amount * COSMIC_PI);
    return linear + (radial * lift + bias * lift * 0.35) * arc;
  }

  vec3 cosmicBaseSurface(vec2 parameter) {
    float veil;
    float planet;
    float orbit;
    float galaxy;
    float horizon;
    cosmicPhases(parameter, veil, planet, orbit, galaxy, horizon);
    float toPlanet = 1.0 - veil;
    float toOrbit = orbit + galaxy + horizon;
    float toGalaxy = galaxy + horizon;
    vec3 shape = cosmicTransport(
      cosmicVeilSurface(parameter),
      cosmicPlanetSurface(parameter),
      toPlanet,
      0.22,
      vec3(0.0, 0.08, 1.0)
    );
    shape = cosmicTransport(
      shape,
      cosmicMobiusSurface(parameter),
      toOrbit,
      0.12,
      vec3(0.18, -0.08, 0.16)
    );
    shape = cosmicTransport(
      shape,
      cosmicGalaxySurface(parameter),
      toGalaxy,
      0.08,
      vec3(-0.12, 0.1, 0.16)
    );
    return cosmicTransport(
      shape,
      cosmicHorizonSurface(parameter),
      horizon,
      0.055,
      vec3(0.0, 0.0, -0.1)
    );
  }

  float cosmicSurfaceRelief(vec2 parameter, vec3 base) {
    float veil;
    float planet;
    float orbit;
    float galaxy;
    float horizon;
    cosmicPhases(parameter, veil, planet, orbit, galaxy, horizon);
    float macro = cosmicMaterialField(parameter);
    float ridges = cosmicMaterialRidges(parameter);
    float craterDistance = cosmicCraterMetric(parameter);
    float craterBowl = 1.0 - cosmicSmoother(0.045, 0.17, craterDistance);
    float craterRim = exp(-pow((craterDistance - 0.18) / 0.035, 2.0));
    float veilWave = sin(parameter.x * 44.0 + uTime * 0.12)
      * cos(parameter.y * 5.2 - uTime * 0.06);
    float filament = sin(parameter.x * 112.0 - uTime * 0.31)
      * exp(-abs(parameter.y) * 3.8);
    float pulseWave = sin(length(base.xy) * 13.0 - uTime * 5.2) * uPulse;
    float displacement = (macro - 0.5) * 0.105 * veil;
    displacement += veilWave * 0.018 * veil;
    displacement += ((macro - 0.5) * 0.074 + (ridges - 0.54) * 0.022) * planet;
    displacement += (-craterBowl * 0.007 + craterRim * 0.0045) * planet;
    displacement += (ridges - 0.52) * 0.009 * orbit;
    displacement += filament * 0.014 * galaxy;
    displacement += pulseWave * mix(0.018, 0.035, orbit + horizon);
    return displacement;
  }

  vec3 cosmicSurfacePoint(vec2 parameter) {
    vec3 base = cosmicBaseSurface(parameter);
    float veil;
    float planet;
    float orbit;
    float galaxy;
    float horizon;
    cosmicPhases(parameter, veil, planet, orbit, galaxy, horizon);
    float radialShape = clamp(planet + orbit + galaxy + horizon, 0.0, 1.0);
    vec3 direction = normalize(mix(vec3(0.0, 0.0, 1.0), base + vec3(0.001), radialShape));
    return base + direction * cosmicSurfaceRelief(parameter, base);
  }

  vec2 cosmicDerivativeParameter(vec2 parameter, vec2 delta, float orbitWeight) {
    vec2 next = parameter + delta;
    if (next.x < 0.0) {
      next.x += 1.0;
      next.y = mix(next.y, -next.y, orbitWeight);
    } else if (next.x > 1.0) {
      next.x -= 1.0;
      next.y = mix(next.y, -next.y, orbitWeight);
    }
    next.y = clamp(next.y, -1.0, 1.0);
    return next;
  }

  vec3 cosmicSurfaceNormal(vec2 parameter) {
    float veil;
    float planet;
    float orbit;
    float galaxy;
    float horizon;
    cosmicPhases(parameter, veil, planet, orbit, galaxy, horizon);
    float nonOrientable = cosmicSmoother(0.18, 0.72, orbit);
    vec2 du = vec2(0.0018, 0.0);
    vec2 dv = vec2(0.0, 0.0045);
    vec3 beforeU = cosmicSurfacePoint(cosmicDerivativeParameter(parameter, -du, nonOrientable));
    vec3 afterU = cosmicSurfacePoint(cosmicDerivativeParameter(parameter, du, nonOrientable));
    vec3 beforeV = cosmicSurfacePoint(cosmicDerivativeParameter(parameter, -dv, nonOrientable));
    vec3 afterV = cosmicSurfacePoint(cosmicDerivativeParameter(parameter, dv, nonOrientable));
    return normalize(cross(afterU - beforeU, afterV - beforeV));
  }
`;
