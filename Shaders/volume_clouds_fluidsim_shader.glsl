#version 300 es
// #extension GL_EXT_shader_texture_lod : require
precision mediump float;
precision mediump sampler3D;

#global_defines
#include "defines"
#include "functions"
#include "sdfunctions"
#include "structs"
//------------------------------------------------------------------------------

#if __VERSION__ >= 300
	#define gl_FragColor out_FragColor
	layout(location = 0) out vec4 out_FragColor;
	// layout(location = 1) out vec4 out_Normal;
	// layout(location = 2) out vec4 out_AoRSMt;
#endif

#if __VERSION__ >= 120
	#define texture2D texture
	#define textureCube texture
	#define textureCubeLod textureLod
	#define texture2DLod textureLod
	#define texture3DLod textureLod
#endif

uniform sampler2D txNoiseRGB;
uniform samplerCube txAmbient;
uniform sampler2D txDepth;
uniform sampler2D txBackground;
uniform sampler3D txFluidSimVelocity;
uniform sampler3D txFluidSimCloud;
uniform sampler3D txFluidSimPressure;
uniform sampler3D txFluidSimDivergence;

uniform int uFlags;
#define getBitFlag(bit) uint_getbit(uFlags, (bit))
uniform float Time;
uniform vec2 Mouse;
uniform vec2 Resolution;
uniform highp vec3 CameraPosition;
uniform float displayBrightness;
//------------------------------------------------------------------------------
#define varyin in

varyin vec3 Normal;
varyin vec3 Tangent;
varyin vec3 Bitangent;
varyin vec3 PixelPosition;
varyin vec2 TexCoords;
varyin vec3 Position;
varyin vec3 ViewVector;

//------------------------------------------------------------------------------
// uniform Light light0;
#include "ubLight"

#if defined(_DEBUG) && !defined(_DEBUG_Clouds_StepCount)
	#define _DEBUG_Display
#endif

#define minimum 0.01
#define p0 vec3(minimum)
#define p1 vec3(1.0-minimum)

float sample_clouds_sphere(in vec3 p, vec3 c, float r){
	if(length(p - c) < r) return 1.0;
	return 0.0;	
}

vec3 position_cloud(in vec3 p){
	p = p * 0.25; 
	p = p + 0.5;
	return p;
}
vec3 inverse_position_cloud(in vec3 p){
	p = p - 0.5;
	p = p / 0.25;
	return p;
}

bool is_in_cloud_space(in vec3 p){
	if(p.x < p0.x || p.y < p0.y || p.z < p0.z) return false;
	if(p.x > p1.x || p.y > p1.y || p.z > p1.z) return false;
	return true;
}

float sample_clouds(in vec3 p)
{
	// return sample_clouds_sphere(p, vec3(0.0,0.0,0.0), 0.5);	
	p = position_cloud(p);
	if(is_in_cloud_space(p) == false) return 0.0;
	
	float d = texture3DLod(txFluidSimCloud, p, 0.0).x;
	return d*0.5;
}

float3 sample_velocity(in vec3 p)
{	
	p = position_cloud(p);
	if(is_in_cloud_space(p) == false) return vec3(0.0);
	
	return texture3DLod(txFluidSimVelocity, p, 0.0).xyz;
}

float sample_pressure(in vec3 p)
{
	p = position_cloud(p);
	if(is_in_cloud_space(p) == false) return 0.0;

	return texture2DLod(txFluidSimPressure, p, 0.0).x;
}

float sample_divergence(in vec3 p)
{
	p = position_cloud(p);
	if(is_in_cloud_space(p) == false) return 0.0;

	return texture2DLod(txFluidSimDivergence, p, 0.0).x;
}

void cloud_bounding_box(out vec3 a, out vec3 b){
	a = inverse_position_cloud(vec3(0.0,0.0,0.0));
	b = inverse_position_cloud(vec3(1.0,1.0,1.0));
}
//===================================================================================================
// SDF gizmo container (scena)
//===================================================================================================

float sdf_map(in vec3 x)
{
	float dist = 1e10;
	float distA = 1e10;
	float distB = 1e10;
	
	const float scale = 2.0f;

	/* vec3 pos = sdf_position(x, vec3(0.0, 0.0, 0.0));
	dist = sdf_combine( dist, sdf_box(vec3(1.0,0.2,2.0), pos));
	dist = sdf_smooth_union( dist, sdf_cylinder_capped(vec2(0.5,2.0), pos), 0.5 );
		 pos = sdf_position(x, vec3(0.0, 0.0, 1.0));
	dist = sdf_combine( dist, sdf_sphere(0.5, pos)); */
	
	vec3 pos = sdf_position(x/scale, vec3(0.0, 0.0, 0.0));
	
	distA = sdf_combine( distA, sdf_box(vec3(2.0,2.0,2.0), pos));
	distA = sdf_intersect( distA, sdf_sphere(2.75, pos));
	
	distB = sdf_combine( distB, sdf_cylinder_capped(vec2(1.5,3.0), pos));
	distB = sdf_union( distB, sdf_cylinder_capped(vec2(1.5,3.0), pos.yxz));
	distB = sdf_union( distB, sdf_cylinder_capped(vec2(1.5,3.0), pos.xzy));
	
	dist = sdf_subtract( distB, distA );
	
	return distA;
}

//http://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormal(in vec3 p){
	return sdf_calc_normal(p, sdf_map);
}

#if defined(Quality_High)
	#define Raymarch_NofSteps 192 //broj samplanja npr za cloudse
	#define Raymarch_CloudShadow_NofSteps 9
	#define Raymarch_DeltaStep(t) (1.0f / float(Raymarch_NofSteps))
	#define Raymarch_CloudShadow_DeltaStep 8.0f
#elif defined(Quality_Med)
	#define Raymarch_NofSteps 128 //broj samplanja npr za cloudse
	#define Raymarch_CloudShadow_NofSteps 6
	#define Raymarch_DeltaStep(t) (1.0f / float(Raymarch_NofSteps))
	#define Raymarch_CloudShadow_DeltaStep 8.0f
#elif defined(Quality_Low)
	#define Raymarch_NofSteps 96 //broj samplanja npr za cloudse
	#define Raymarch_CloudShadow_NofSteps 4
	#define Raymarch_DeltaStep(t) (1.0f / float(Raymarch_NofSteps))
	#define Raymarch_CloudShadow_DeltaStep 8.0f
#elif defined(Quality_UltraLow)
	#define Raymarch_NofSteps 48 //broj samplanja npr za cloudse
	#define Raymarch_CloudShadow_NofSteps 2
	#define Raymarch_DeltaStep(t) (1.0f / float(Raymarch_NofSteps))
	#define Raymarch_CloudShadow_DeltaStep 8.0f
#endif

#define cloudColor (vec3(0.1,0.5,0.4))
#define cloudShadowColor (vec3(0.4,0.47,0.6))
#define lightIntensity (4.0)

bool isEdge(in vec3 p){
	const float eps = 0.005f;
	p = position_cloud(p);
	
	if(float_equals(p.x, 0.0f, eps) && float_equals(p.y, 0.0f, eps)) return true;
	if(float_equals(p.x, 0.0f, eps) && float_equals(p.y, 1.0f, eps)) return true;
	if(float_equals(p.x, 1.0f, eps) && float_equals(p.y, 0.0f, eps)) return true;
	if(float_equals(p.x, 1.0f, eps) && float_equals(p.y, 1.0f, eps)) return true;
	
	if(float_equals(p.x, 0.0f, eps) && float_equals(p.z, 0.0f, eps)) return true;
	if(float_equals(p.x, 0.0f, eps) && float_equals(p.z, 1.0f, eps)) return true;
	if(float_equals(p.x, 1.0f, eps) && float_equals(p.z, 0.0f, eps)) return true;
	if(float_equals(p.x, 1.0f, eps) && float_equals(p.z, 1.0f, eps)) return true;
	
	if(float_equals(p.y, 0.0f, eps) && float_equals(p.z, 0.0f, eps)) return true;
	if(float_equals(p.y, 0.0f, eps) && float_equals(p.z, 1.0f, eps)) return true;
	if(float_equals(p.y, 1.0f, eps) && float_equals(p.z, 0.0f, eps)) return true;
	if(float_equals(p.y, 1.0f, eps) && float_equals(p.z, 1.0f, eps)) return true;
	
	return false;
}

float RaymarchCloudShadowSample(in vec3 start, in vec3 dir, in float ds)
{
	float s = 0.0f;
	float shadow = 1.0f;
	#define shadowMult (1.5f+(1.0f / float(Raymarch_CloudShadow_NofSteps)))
	#define shadowSampleDelta (ds*Raymarch_CloudShadow_DeltaStep*(1.0f/float(Raymarch_CloudShadow_NofSteps)))

	for(int i = 0; i < Raymarch_CloudShadow_NofSteps; ++i)
	{
		vec3 ray = start + s*dir;
		shadow = saturate(shadow - sample_clouds(ray) * shadowMult*shadow);
		s += shadowSampleDelta;
	}
	
	return shadow;
}

vec4 RaymarchMulti(in vec3 start, in vec3 dir, in float tstart, in float maxt, in float depth, in float dither)
{
	#ifdef _DEBUG
		int StepCount = 0;
		bool bCubeEdge = false;
	#endif
	
	Light light0 = Lights[0].light;
	
	float t = tstart+dither;
	depth = depth+dither;
	vec4 colorsum = vec4(0.0);
	
	float dt = (maxt - tstart) / float(Raymarch_NofSteps);
			
	for(int i = 0; i < Raymarch_NofSteps; ++i)
	{
		#ifdef _DEBUG_Clouds_StepCount
			StepCount++;
		#endif
		
		vec3 ray = start + t*dir;
		
		#ifndef _DEBUG_Display //raymarch oblaka i sjencanje
			
			vec3 lightDir = light0.position.xyz - ray;
			
			float lited = light0.intensity / ((dot(lightDir,lightDir))); lited = clamp(lited,0.0,4.0*light0.intensity);
			float shadow = RaymarchCloudShadowSample(ray, normalize(lightDir), dt);
					
			float3 color = cloudColor;
			color *= lited;
			color *= lerp( cloudShadowColor, vec3(1.0), shadow);
			
			float dens = sample_clouds(ray);
			colorsum.a += dens;
			colorsum.rgb += dens*color;
			
		#else //debug prikaz
		
		if(isEdge(ray) == true){ bCubeEdge = true; break; }
		
		#if defined(_DEBUG_Display_Velocity) || defined(_DEBUG_Display_VelocitySize)
			vec3 velocity = sample_velocity(ray);
			
			#if defined(_DEBUG_Display_Velocity)
				float velocitySize = length(velocity) / float((Raymarch_NofSteps));
			#elif defined(_DEBUG_Display_VelocitySize)
				float velocitySize = length(velocity)*displayBrightness/125.0;
			#endif
			
			colorsum.a += velocitySize;
			colorsum.rgb += velocitySize*velocity;
		#endif
		
		#ifdef _DEBUG_Display_Pressure
			float pressure = sample_pressure(ray)*displayBrightness/125.0;
			
			colorsum.a += abs(pressure);
			colorsum.r += pressure;
		#endif
		
		#ifdef _DEBUG_Display_Divergence
			float diverg = sample_divergence(ray)*displayBrightness/125.0;
			
			colorsum.a += abs(diverg);
			colorsum.r += diverg;
		#endif
		
		#endif //_DEBUG_Display		
		
		t += dt;
		if(t > depth) break;
		if(colorsum.a > 0.995f) break;
	}
	
	#ifndef _DEBUG
		colorsum.a = colorsum.a / 0.995f;
		return colorsum;
	#else
		if(bCubeEdge == true){
			return vec4(1.0,1.0,1.0,1.0); }
	
		#ifdef _DEBUG_Clouds_StepCount
			float fStepCount = float(StepCount) / float( (Raymarch_NofSteps) );
			return lerp3pt(vec4(0.0,0.5,1.0,1.0), vec4(0.5,1.0,0.0,1.0), vec4(1.0,0.0,0.0,1.0), fStepCount);
		#endif
		
		#ifdef _DEBUG_Display_Velocity
			vec3 vdisplay = (colorsum.xyz*displayBrightness) * 0.5 + 0.5;
			return tovec4(vdisplay, 1.0);
		#endif
		
		#ifdef _DEBUG_Display_VelocitySize
			return lerp3pt(vec4(0.0,0.5,1.0,1.0), vec4(0.5,1.0,0.0,1.0), vec4(1.0,0.0,0.0,1.0), colorsum.a);
		#endif
		
		#ifdef _DEBUG_Display_Pressure
			// return lerp3pt(vec4(0.0,0.5,1.0,1.0), vec4(0.5,0.5,0.5,1.0), vec4(1.0,0.0,0.0,1.0), colorsum.r*0.5+0.5);
			return lerp3pt(vec4(0.0,0.0,0.0,1.0), vec4(0.5,0.5,0.5,1.0), vec4(1.0,1.0,1.0,1.0), colorsum.r*0.5+0.5);
		#endif
		
		#ifdef _DEBUG_Display_Divergence
			return lerp3pt(vec4(0.0,0.0,0.0,1.0), vec4(0.5,0.5,0.5,1.0), vec4(1.0,1.0,1.0,1.0), colorsum.r*0.5+0.5);
		#endif
		
		return vec4(1.0,0.0,1.0,1.0);
	#endif
}
//===================================================================================================

#define Near 0.1
#define Far 1000.0

//===================================================================================================
//pronalazi jeli potrebno izvrsavat RaymarchMulti funkciju, i na kojoj udaljenosti gledat za t
//===================================================================================================
#define Raymarch_SDF_Tfind_NofSteps 16

float RaymarchSDFfindT(in vec3 start, in vec3 dir, float t, float disttreshold, float maxt)
{
	for(int i = 0; i < Raymarch_SDF_Tfind_NofSteps; ++i)
	{
		vec3 ray = start + t*dir;
		float dist = sdf_map(ray);
		
		if(abs(dist) <= disttreshold){ return max(t, 0.0); }
		
		t += (dist);
	}
	
	if(t > maxt)
		return -1.0;
		
	return max(t, 0.0);
}
//===================================================================================================


bool rayIntersectsCloudBSphere(vec3 pos, vec3 dir){
	
	vec3 C = inverse_position_cloud(vec3(0.5,0.5,0.5));
	float R = length(inverse_position_cloud(vec3(1.0,1.0,1.0)));
	
	float2 t;
	return intersectRaySphere(pos, dir, C, R, t);
}

bool rayIntersectsCloudBBox(vec3 pos, vec3 dir){
	
	vec3 bBox[2]; cloud_bounding_box(bBox[0], bBox[1]);
	
	float2 t;
	return intersectRayBBox(pos, dir, bBox[0], bBox[1], t);
}

void main(void)
{	
	Light light0 = Lights[0].light;
	float dither = 0.025f*(0.5f+0.5f*rand(TexCoords))*(192.0f/float(Raymarch_NofSteps));
	// dither = 0.0;
	
	vec2 mouse = Mouse.xy / Resolution.xy;
	
	bool bMaliRect = (TexCoords.x < 0.0125f && TexCoords.y < 0.0125f);
	
	vec4 bckgColor = texture2D(txBackground, TexCoords);
	float bckgDepth = texture2DLod(txDepth, TexCoords,0.0).x;
	vec3 normal = Normal;
	vec3 toCamera = normalize(-ViewVector);
	vec3 toLight = normalize(light0.position.xyz - Position);
	vec3 ViewDir = normalize(ViewVector);
	
	float depth = LinearizeDepth(bckgDepth, Near, Far);
	depth = depth * (Far - Near) + Near;
	depth *= 0.5;
	
	vec4 rtn = vec4(0.0);
	float startT = max(length(CameraPosition) - 2.0, 0.0); //u centru je od 0.0 do 1.0 cloud
	float maxT = 4.0f;
	
	vec3 pos = CameraPosition;
	
	// bool bTrace = rayIntersectsCloudBSphere(pos, ViewDir);
	bool bTrace = rayIntersectsCloudBBox(pos, ViewDir);
	
	if(bTrace == true)
		rtn = RaymarchMulti(pos, ViewDir, startT, startT+maxT, depth, dither);
	else
		rtn = vec4(0.0);
	
	/* #if defined(Quality_High)
		if(bMaliRect == true) rtn.xyz = vec3(1.0,0.5,0.0);
	#endif
	#if defined(Quality_Med)
		if(bMaliRect == true) rtn.xyz = vec3(0.0,1.0,0.5);
	#endif
	#if defined(Quality_Low)
		if(bMaliRect == true) rtn.xyz = vec3(0.0,0.5,1.0);
	#endif
	#if defined(Quality_UltraLow)
		if(bMaliRect == true) rtn.xyz = vec3(0.0,0.2,1.0);
	#endif */
	
	#ifndef _DEBUG
		float alpha = (bckgDepth < 0.9999f)? saturate(rtn.a) : 1.0f;
		rtn.xyz = lerp(bckgColor.xyz, rtn.xyz, alpha);
	#endif
	
	gl_FragColor = tovec4(vec3(rtn.xyz), 1.0);
}

























