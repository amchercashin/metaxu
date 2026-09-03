import{S as e,a6 as a}from"./index-BrsfXN4h.js";const o="rgbdEncodePixelShader",n=`varying vec2 vUV;uniform sampler2D textureSampler;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=toRGBD(texture2D(textureSampler,vUV).rgb);}`;e.ShadersStore[o]||(e.ShadersStore[o]=n);const t=[a];for(const r of t)e.IncludesShadersStore[r.name]||(e.IncludesShadersStore[r.name]=r.shader);const s={name:o,shader:n};export{s as rgbdEncodePixelShader};
