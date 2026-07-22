uniform float uTime;

void main(){
 vec3 p = position;
 p += normal * sin(uTime + position.x * 3.0) * 0.02;
 gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
}
