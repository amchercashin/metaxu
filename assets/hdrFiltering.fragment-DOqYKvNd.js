import{S as e,aY as o,ba as a,bb as t,bc as c}from"./index-sBuscneu.js";const r="hdrFilteringPixelShader",i=`#include<helperFunctions>
#include<importanceSampling>
#include<pbrBRDFFunctions>
#include<hdrFilteringFunctions>
uniform float alphaG;uniform samplerCube inputTexture;uniform vec2 vFilteringInfo;uniform float hdrScale;varying vec3 direction;void main() {vec3 color=radiance(alphaG,inputTexture,direction,vFilteringInfo);gl_FragColor=vec4(color*hdrScale,1.0);}`;e.ShadersStore[r]||(e.ShadersStore[r]=i);const l=[o,a,t,c];for(const n of l)e.IncludesShadersStore[n.name]||(e.IncludesShadersStore[n.name]=n.shader);const s={name:r,shader:i};export{s as hdrFilteringPixelShader};
