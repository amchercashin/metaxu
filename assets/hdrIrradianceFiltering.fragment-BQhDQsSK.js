import{S as e,aY as o,ba as c,bb as a,bc as t}from"./index-sjUA0Uw-.js";const i="hdrIrradianceFilteringPixelShader",n=`#include<helperFunctions>
#include<importanceSampling>
#include<pbrBRDFFunctions>
#include<hdrFilteringFunctions>
uniform samplerCube inputTexture;
#ifdef IBL_CDF_FILTERING
uniform sampler2D icdfTexture;
#endif
uniform vec2 vFilteringInfo;uniform float hdrScale;varying vec3 direction;void main() {vec3 color=irradiance(inputTexture,direction,vFilteringInfo,0.0,vec3(1.0),direction
#ifdef IBL_CDF_FILTERING
,icdfTexture
#endif
);gl_FragColor=vec4(color*hdrScale,1.0);}`;e.ShadersStore[i]||(e.ShadersStore[i]=n);const d=[o,c,a,t];for(const r of d)e.IncludesShadersStore[r.name]||(e.IncludesShadersStore[r.name]=r.shader);const s={name:i,shader:n};export{s as hdrIrradianceFilteringPixelShader};
