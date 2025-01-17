import * as glext from "./GLExt/GLExt.js"
import * as sys from "./System/sys.js"
import * as vMath from "./glMatrix/gl-matrix.js"

var gl = null;

var bUseHDR = false;
var bStoreHDRinRGBA8 = true;

export function main(){
	
	var gs = sys.storage.CGlobalStorage.getSingleton();
	sys.mouse.InitMouse(document);
	
	gl = glext.glInit("glcanvas");
		 if(glext.isWGL2 && glext.glEnableExtension('OES_texture_float') == false) alert("no extension: OES_texture_float");
		 if(glext.isWGL2 && glext.glEnableExtension('EXT_shader_texture_lod') == false) alert("no extension: EXT_shader_texture_lod");
		 if(glext.glEnableExtension('OES_texture_float_linear') == false) alert("no extension: OES_texture_float_linear");
	if(gl == null) return;
	
	glext.InitDebugTextDOM("debug_text");
	
	var zA = new sys.zip.CZip();
	zA.AsyncFetchAndLoadFile("Textures/venice_hdr.zip", true, function(zB){
		if(zB.isUnpacked() == false) alert("zB.isUnpacked() == false");
	});
	
	gl.clearColor(0.0, 1.0, 1.0, 1.0);
	gl.blendColor(1.0, 1.0, 1.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.clearDepth(1.0); 
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.disable(gl.CULL_FACE);
	gl.frontFace(gl.CCW);
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	
	// gl.enable(gl.TEXTURE_CUBE_MAP_SEAMLESS);
	
	gl.disable(gl.BLEND);
	gl.depthFunc(gl.LESS);
	
	glext.CBlendMode.Init();
	
	if(bUseHDR == true && bStoreHDRinRGBA8 == true)
		glext.CShaderDefines.addGlobalDefine("USE_HDR_RGBA8","");
	else if(bUseHDR == true)
		glext.CShaderDefines.addGlobalDefine("USE_HDR","");
	
	glext.CShaderDefines.addGlobalDefine("MAX_LIGHTS", " "+glext.MAX_LIGHTS);
	
	var shader = new glext.CShader(0);
	if(shader.CompileFromFile("simpleVS", "deferred_BcNAoRSMt") == false) alert("nije kompajliran shader!");
	shader.setVertexAttribLocations("aVertexPosition","aVertexNormal","aVertexTangent",null,"aTexCoords");
	shader.setTransformMatricesUniformLocation("ModelMatrix","ViewMatrix","ProjectionMatrix");
	shader.setDefaultTextureUniformLocations("txDiffuse","txNormal","txAoRS");
	shader.setBRDFLUTTextureUniformLocation("txBRDF");
	shader.setFlagsUniformLocation("uFlags");
	shader.setTimeUniformLocation("Time");
	shader.setCameraPositionUniformLocation("CameraPosition");

/* uniform sampler2D txDiffuse; uniform float txDiffuse_gamma_value;
uniform sampler2D txNormal; uniform float txNormal_gamma_value;
uniform sampler2D txAoRS; uniform float txAoRS_gamma_value; */
	
	shader.ULTextureAmb = shader.getUniformLocation("txAmbient");
	shader.ULTextureDiffuseGamma = shader.getUniformLocation("txDiffuse_gamma_value");
	shader.ULTextureNormalGamma = shader.getUniformLocation("txNormal_gamma_value");
	shader.ULTextureAoRSGamma = shader.getUniformLocation("txAoRS_gamma_value");
	shader.ULRoughnessScaleOffsetPower = shader.getUniformLocation("roughnessScaleOffsetPower");
	shader.ULEmissionMult = shader.getUniformLocation("emissionMult");
	
	shader.setFloatUniform(shader.ULTextureDiffuseGamma, 1.0);
	shader.setFloatUniform(shader.ULTextureNormalGamma, 1.0);
	shader.setFloatUniform(shader.ULTextureAoRSGamma, 1.0);
	shader.setFloatUniform(shader.ULEmissionMult, 0.0);
	shader.setFloat3Uniform(shader.ULRoughnessScaleOffsetPower, [2.75,0.0,1.0]);
	
	var skybox_shader = new glext.CShader(1);
	if(skybox_shader.CompileFromFile("simpleVS", "deferred_skybox") == false) alert("nije kompajliran shader!");
	skybox_shader.ULTextureAmb = skybox_shader.getUniformLocation("txAmbient");
	skybox_shader.InitDefaultUniformLocations();
	skybox_shader.InitDefaultAttribLocations();
	
	var deferred_opaque_shader = new glext.CShader(2);
	if(deferred_opaque_shader.CompileFromFile("viewquadVS", "deferred_opaque_shader") == false) alert("nije kompajliran shader!");
	deferred_opaque_shader.InitDefaultAttribLocations();
	deferred_opaque_shader.InitDefaultUniformLocations();
	deferred_opaque_shader.ULInvViewProjMatrix = deferred_opaque_shader.getUniformLocation("InverseViewProjectionMatrix");
	deferred_opaque_shader.ULCameraForwardDir = deferred_opaque_shader.getUniformLocation("CameraForwardDir");
	deferred_opaque_shader.ULCameraRightDir = deferred_opaque_shader.getUniformLocation("CameraRightDir");
	deferred_opaque_shader.ULCameraUpDir = deferred_opaque_shader.getUniformLocation("CameraUpDir");
	
	var transparent_shader = new glext.CShader(3);
	if(transparent_shader.CompileFromFile("simpleVS", "transparent_shader") == false) alert("nije kompajliran shader!");
	transparent_shader.InitDefaultAttribLocations();
	transparent_shader.InitDefaultUniformLocations();
	transparent_shader.ULTextureAmb = transparent_shader.getUniformLocation("txAmbient");
	transparent_shader.ULTextureBackground = transparent_shader.getUniformLocation("txBackground");
	transparent_shader.ULroughnessScaleOffsetPower = transparent_shader.getUniformLocation("roughnessScaleOffsetPower");
	
	transparent_shader.setFloat3Uniform(transparent_shader.ULroughnessScaleOffsetPower, [0.58,0.25,1.0]);
	
	var backbuffer_shader = new glext.CShader(4);
	if(backbuffer_shader.CompileFromFile("simpleVS", "backbuffer_shader") == false) alert("nije kompajliran shader!");
	backbuffer_shader.InitDefaultAttribLocations();
	backbuffer_shader.InitDefaultUniformLocations();
	
	var atmosphere_shader = new glext.CShader(5);
	if(atmosphere_shader.CompileFromFile("simpleVS", "atmosphere_shader") == false) alert("nije kompajliran shader!");
	atmosphere_shader.InitDefaultAttribLocations();
	atmosphere_shader.InitDefaultUniformLocations();
	
	var SkySphereModel = new glext.CModel(0);
	SkySphereModel.ImportFrom("SphereModel");
	// glext.GenCubeModel(model);
	 
	var model = new glext.CModel(1);
	model.ImportFrom("displayModel");
	
	var modelGlass = new glext.CModel(2);
	modelGlass.ImportFrom("displayModel");
	
	var quad_model = new glext.CModel(2);
	glext.GenQuadModel(quad_model);
	
	var AtmoSphereModel = new glext.CModel(4);
	AtmoSphereModel.ImportFrom("SphereModel");
	
	var txBRDF_LUT = new glext.CTexture(3); txBRDF_LUT.CreateFromFile("txBRDF_LUT");
	txBRDF_LUT.setWrapTypeClampToEdge();
	
	var txD = new glext.CTexture(0); txD.CreateFromFile("txRock_D");
	var txN = new glext.CTexture(1); txN.CreateFromFile("txRock_N");
	var txAoRS = new glext.CTexture(2); txAoRS.CreateFromFile("txRock_AoRS");
	
	var txGlassAoRS = new glext.CTexture(-1); txGlassAoRS.CreateFromFile("txGlass_AoRS");
	var txGlassN = new glext.CTexture(-1); txGlassN.CreateFromFile("txGlass_N");
	
	var txAtmosphere = new glext.CTexture(-1); txAtmosphere.CreateFromFile("txAtmosphere");
	
	// var txAmb = new glext.CTextureCube(0); txAmb.CreateFromDOMDataElements("tx128");	
	var txAmb = new glext.CTextureCube(0); txAmb.CreateFromMultipleElementsInDOM("txAmbHDRVenice");	
	
	var light = new glext.CLight(0);
	// var lightUniforms = glext.CLight.getUniformLocationsFromShader(shader,"light0");
	// var lightUniforms_backbuffer_shader = glext.CLight.getUniformLocationsFromShader(deferred_opaque_shader,"light0");
	// atmosphere_shader.lightUniforms = glext.CLight.getUniformLocationsFromShader(atmosphere_shader, "light0");
	// light.AttachUniformBlockTo(shader);	
	
	var projectionMatrix = vMath.mat4.create();
	var viewMatrix = vMath.mat4.create();
	
	var eyePt = vMath.vec3.fromValues(-2.75,0.0,0.0);
	var centerPt = vMath.vec3.fromValues(0.0,0.0,0.0);
	var upDir = vMath.vec3.fromValues(0.0,0.0,1.0);
	
	eyePt = [ -1.156, -2.035, 1.444 ];
	upDir = [ -0.907, 0.352, -0.230 ];
	
	//framebuffer
	//------------------------------------------------------------------------
	var fbo_width = gl.viewportWidth; var fbo_height = gl.viewportHeight;
	var txfbColor = new glext.CTexture(4); txfbColor.CreateEmptyRGBAubyte(fbo_width, fbo_height);
	var txfbDepth = new glext.CTexture(5); txfbDepth.CreateEmptyDepthfloat(fbo_width, fbo_height);
	var txfbNormal= new glext.CTexture(6); txfbNormal.CreateEmptyRGBAubyte(fbo_width, fbo_height);
	var txfbAoRSMt= new glext.CTexture(7); txfbAoRSMt.CreateEmptyRGBAubyte(fbo_width, fbo_height);
	var fbo = new glext.CFramebuffer(true);   fbo.Create(); 
	fbo.AttachTexture(txfbColor, 0);
	fbo.AttachTexture(txfbNormal,1);
	fbo.AttachTexture(txfbAoRSMt,2);
	fbo.AttachDepth(txfbDepth);
	fbo.CheckStatus();
	
	var fboHdrMipBlur = new glext.CFramebuffer(true); fboHdrMipBlur.Create(); fboHdrMipBlur.Bind();
	var txfbHdrMipBlur = new glext.CTexture(8); txfbHdrMipBlur.CreateEmptyWithMipsRGBAubyte(fbo_width, fbo_height);
	fboHdrMipBlur.AttachTexture(txfbHdrMipBlur, 0);
	fboHdrMipBlur.AttachDepth(txfbDepth);
	fboHdrMipBlur.CheckStatus();
	
	glext.CFramebuffer.BindMainFB();	
	//------------------------------------------------------------------------
		glext.CLightList.addLight(light);
		
		glext.CTextureList.addTexture(txD);
		glext.CTextureList.addTexture(txN);
		glext.CTextureList.addTexture(txAoRS);
		glext.CTextureList.addTexture(txGlassN);
		glext.CTextureList.addTexture(txGlassAoRS);
		glext.CTextureList.addTexture(txBRDF_LUT);
		glext.CTextureList.addTexture(txAmb);
		glext.CTextureList.addTexture(txfbColor);
		glext.CTextureList.addTexture(txfbNormal);
		glext.CTextureList.addTexture(txfbAoRSMt);
		glext.CTextureList.addTexture(txfbDepth);
		glext.CTextureList.addTexture(txfbHdrMipBlur);
		glext.CTextureList.addTexture(txAtmosphere);
		
		glext.CShaderList.addShader(shader);
		glext.CShaderList.addShader(skybox_shader);
		glext.CShaderList.addShader(deferred_opaque_shader);
		glext.CShaderList.addShader(transparent_shader);
		glext.CShaderList.addShader(backbuffer_shader);
		glext.CShaderList.addShader(atmosphere_shader);
		
		model.setTexture(txD,"txDiffuse");
		model.setTexture(txN,"txNormal");
		model.setTexture(txAoRS,"txAoRS");
		// model.setTexture(txAmb,"txAmbient");
		model.setShader(shader);
		
		SkySphereModel.setTexture(txAmb,"txAmbient");
		SkySphereModel.setShader(skybox_shader);
		
		AtmoSphereModel.setTexture(txAtmosphere, "txDiffuse");
		AtmoSphereModel.setShader(atmosphere_shader);
		AtmoSphereModel.setBlendMode(glext.CBlendMode.Alpha);
		
		modelGlass.setTexture(txGlassN,"txNormal");
		modelGlass.setTexture(txGlassAoRS,"txAoRS");
		modelGlass.setTexture(txfbDepth,"txDepth");
		modelGlass.setTexture(txBRDF_LUT,"txBRDF");
		modelGlass.setTexture(txAmb,"txAmbient");
		modelGlass.setTexture(txfbHdrMipBlur,"txBackground");
		modelGlass.setShader(transparent_shader);
		
		quad_model.setTexture(txfbColor,"txDiffuse");
		quad_model.setTexture(txfbNormal,"txNormal");
		quad_model.setTexture(txfbAoRSMt,"txAoRS");
		quad_model.setTexture(txfbDepth,"txDepth");
		quad_model.setTexture(txBRDF_LUT,"txBRDF");
		quad_model.setTexture(txAmb,"txAmbient");
		quad_model.setShader(deferred_opaque_shader);
		
		light.AttachUniformBlockTo(deferred_opaque_shader);	
		light.AttachUniformBlockTo(transparent_shader);	
		light.AttachUniformBlockTo(atmosphere_shader);	
		
	txfbHdrMipBlur.setMinMagFilterLinearMipMapLinear();
	//------------------------------------------------------------------------
	
	vMath.mat4.perspective(projectionMatrix, vMath.deg2rad(40.0), gl.viewportWidth/gl.viewportHeight, 0.1, 1000.0);
	
	vMath.mat4.lookAt(viewMatrix, eyePt, centerPt, upDir);
	// vMath.mat4.identity(viewMatrix);
	// vMath.mat4.translate(viewMatrix, viewMatrix, [0.0, 0.0, -7.0]);
	
	var Camera = new glext.CCamera(0, gl.viewportWidth, gl.viewportHeight);
	Camera.setPositionAndDir(eyePt, [1.0,0.0,0.0], upDir);
	Camera.UpdateProjectionMatrix();
	
	var CenterCamera = new glext.CCamera(1, gl.viewportWidth, gl.viewportHeight);
	vMath.mat4.identity(CenterCamera.ViewMatrix);
	CenterCamera.Position = [0.0,0.0,0.0];
	CenterCamera.ProjectionMatrix = Camera.ProjectionMatrix;
	vMath.mat4.copy(CenterCamera.ViewMatrix, Camera.ViewMatrix);
	vMath.mat4.setTranslation(CenterCamera.ViewMatrix, CenterCamera.ViewMatrix, [0.0,0.0,0.0]);
	
	vMath.mat4.identity(model.Transform);
	// vMath.mat4.scale(model.Transform, model.Transform, [4.0,4.0,4.0]);
	vMath.mat4.rotate(model.Transform, model.Transform, vMath.deg2rad(180.0), [1,0,0]);
	// vMath.mat4.rotate(model.Transform, model.Transform, vMath.deg2rad(90.0), [0,1,0]);
	vMath.mat4.rotate(model.Transform, model.Transform, vMath.deg2rad(90.0), [0,0,1]);
	
	vMath.mat4.identity(modelGlass.Transform);
	vMath.mat4.rotate(modelGlass.Transform, modelGlass.Transform, vMath.deg2rad(180.0), [1,0,0]);
	vMath.mat4.rotate(modelGlass.Transform, modelGlass.Transform, vMath.deg2rad(90.0), [0,0,1]);
	vMath.mat4.translate(modelGlass.Transform, modelGlass.Transform, [0.0, 0.0, 1.5]);

	vMath.mat4.identity(AtmoSphereModel.Transform); var atmoScale = 1.012;
	vMath.mat4.scale(AtmoSphereModel.Transform, AtmoSphereModel.Transform, [atmoScale,atmoScale,atmoScale]);
	
	vMath.mat4.identity(SkySphereModel.Transform);
	vMath.mat4.scale(SkySphereModel.Transform, SkySphereModel.Transform, [10.0,10.0,10.0]);
	vMath.mat4.rotate(SkySphereModel.Transform, SkySphereModel.Transform, vMath.deg2rad(-90.0), [1,0,0]);
	
	var time = 0.0;
	sys.time.init();
	
	shader.setFlagsUniform(1);
	
	var IdentityMatrix = vMath.mat4.create();
	vMath.mat4.identity(IdentityMatrix);
	
	var MipGen = new glext.CMipMapGen();
	if((bUseHDR == false) || (bUseHDR == true && bStoreHDRinRGBA8 == true))
		MipGen.Create(gl.viewportWidth, gl.viewportHeight, gl.RGBA8, "mipmapVS", "3x3MipGenFS");
	else
		MipGen.Create(gl.viewportWidth, gl.viewportHeight, gl.RGBA16F, "mipmapVS", "3x3MipGenFS");
	
	// var Flags = 1;
	// var time_of_start = sys.time.getTimeµs();
	glext.CBlendMode.Enable();
	
	setInterval( function(){ window.requestAnimationFrame(renderFrame); }, 25);
		
	// var circularMov = [0.0, 0.0]; //azimuth, inclination
	// var distFromObject = 7.0;
	
	var orbital = [];
	orbital.radius = 2.75;
	orbital.inclination = 0.0;
	orbital.azimuth = 0.0;
	orbital.dinclination = 0.0;
	orbital.dazimuth = 0.0;
	
	var RightAdd = vMath.vec3.create();
	var UpAdd = vMath.vec3.create();
	
	var bEnableRotation = false;
	var bUpdateCamera = true;
	
	function renderFrame()
	{
		time = sys.time.getSecondsSinceStart();
		var ctime = Math.cos(time);
		var stime = Math.sin(time);
		var ctime10 = Math.cos(10*time);
		
		if(checkWindowsSizeAndResizeCanvas() == true){
			Camera.setViewportWidthHeight(gl.viewportWidth,gl.viewportHeight);}
		
		if(bEnableRotation){
			vMath.mat4.identity(model.Transform);
			vMath.mat4.rotate(model.Transform, model.Transform, vMath.deg2rad(time*10), [0,0,1]);/*  */
		}
		
		if(false){
			vMath.mat4.identity(modelGlass.Transform);
			vMath.mat4.setTranslation(modelGlass.Transform, modelGlass.Transform, [ -1.0, -ctime*0.5, 0.0]);
			vMath.mat4.rotate(modelGlass.Transform, modelGlass.Transform, vMath.deg2rad(90), [0,1,0]);
		}
		// glext.CFramebuffer.BindMainFB();
		
		//Calc camera view i proj
		//-------------------------------------------------------------------------------------
		
		
		var mousePos = sys.mouse.getPosition();
		var mouseDelta = sys.mouse.getDeltaPosition();
			
		orbital.dinclination = 0.0;
		orbital.dazimuth = 0.0;
		
		if(sys.mouse.get().btnLeft == true)
		{
			if(mouseDelta[0] != 0 || mouseDelta[1] != 0)
			{
				orbital.dazimuth = -mouseDelta[0];
				orbital.dinclination = mouseDelta[1];
				
				bUpdateCamera = true;
			}
		}
		
		if(sys.mouse.get().dz != 0)
		{
			orbital.radius = orbital.radius - orbital.radius*(sys.mouse.get().dz / 20.0);
			if(orbital.radius < 0.1) orbital.radius = 0.1;
			if(orbital.radius > 100.0) orbital.radius = 100.0;
			bUpdateCamera = true;
		}
		
		if(bUpdateCamera == true)
		{			
			// eyePt = vMath.sph2cart3D(orbital.azimuth, orbital.inclination, orbital.radius);
			var sinA = Math.sin(vMath.deg2rad(orbital.dazimuth)); var sinI = Math.sin(vMath.deg2rad(orbital.dinclination));
			vMath.vec3.scale(RightAdd, Camera.RightDir, orbital.radius * sinA);
			vMath.vec3.scale(UpAdd, Camera.UpDir, orbital.radius * sinI);
			vMath.vec3.add(eyePt, eyePt, RightAdd);
			vMath.vec3.add(eyePt, eyePt, UpAdd);
			
			vMath.vec3.normalize(eyePt, eyePt);
			vMath.vec3.scale(eyePt, eyePt, orbital.radius);
			
			Camera.setPositionAndLookPt(eyePt, [0.0,0.0,0.0], upDir);
			Camera.CalcInverseViewProjectionMatrix();
			
			vMath.vec3.copy(upDir, Camera.UpDir);
			
			vMath.mat4.copy(CenterCamera.ViewMatrix, Camera.ViewMatrix);
			vMath.mat4.setTranslation(CenterCamera.ViewMatrix, CenterCamera.ViewMatrix, [0.0,0.0,0.0]);
		}
		
		/*
		if(sys.mouse.get().btnLeft == true)
			if(sys.mouse.get().dx != 0 || sys.mouse.get().dy != 0){
				Camera.Rotate(sys.mouse.get().dx / 100.0, sys.mouse.get().dy / 100.0);
				Camera.CalcInverseViewProjectionMatrix();
			} 
		*/
		//-------------------------------------------------------------------------------------
		
		glext.CTexture.Unbind(0);
		glext.CTexture.Unbind(1);
		glext.CTexture.Unbind(2);
		glext.CTexture.Unbind(3);
		
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);		
		
		gl.clearColor(0.25, 0.5, 0.75, 1.0);
		gl.clearDepth(1.0);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
		gl.disable(gl.DEPTH_TEST);
		RenderModels(fbo, true, time, CenterCamera, [SkySphereModel]);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		
		RenderModels(fbo, false, time, Camera, [model]);
		
		light.setLightType(glext.CLight.ELightType.Directional);
		light.setPosition(-2.0*ctime, 2.0, 2.0);
		light.setDisplaySize(5.0);
		light.setDisplayColor(0.5,0.79,1.0,1.0);
		light.setMatrices( Camera.ViewMatrix, Camera.ProjectionMatrix );
		light.RenderPosition();
		light.setIntensity(1.0);
		light.setColor(0.5,0.79,1.0,1.0);
		light.Update();
			
		/* 	 */
		glext.CTexture.Unbind(0);
		glext.CTexture.Unbind(1);
		glext.CTexture.Unbind(2);
		glext.CTexture.Unbind(3);
		
		
		fboHdrMipBlur.Bind();
		fboHdrMipBlur.DetachDepth();
		gl.viewport(0, 0, fboHdrMipBlur.width, fboHdrMipBlur.height);
			
			gl.clearColor(0.5, 0.5, 0.5, 1.0);
			gl.clearDepth(1.0);
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			
			fboHdrMipBlur.ActivateDrawBuffers(deferred_opaque_shader);
			
			deferred_opaque_shader.Bind();
			
				// txfbColor.Bind(0, deferred_opaque_shader.ULTextureD);
				quad_model.BindTexturesToShader(deferred_opaque_shader);
				
				deferred_opaque_shader.setViewMatrixUniform( IdentityMatrix );
				deferred_opaque_shader.setProjectionMatrixUniform( IdentityMatrix );
				
				deferred_opaque_shader.setTimeUniform(time);
				
				deferred_opaque_shader.setCameraPositionUniform(Camera.Position);
				deferred_opaque_shader.setFloat3Uniform(deferred_opaque_shader.ULCameraForwardDir, Camera.ForwardDir);
				deferred_opaque_shader.setFloat3Uniform(deferred_opaque_shader.ULCameraRightDir, Camera.RightDir);
				deferred_opaque_shader.setFloat3Uniform(deferred_opaque_shader.ULCameraUpDir, Camera.UpDir);
				deferred_opaque_shader.setMatrix4Uniform(deferred_opaque_shader.ULInvViewProjMatrix, Camera.InverseViewProjectionMatrix);
				
				// light.UploadToShader(deferred_opaque_shader, lightUniforms_backbuffer_shader);
				
				quad_model.RenderIndexedTriangles(deferred_opaque_shader);		
		
		//atmosphere render
		fboHdrMipBlur.AttachDepth(txfbDepth);
		// light.UploadToShader(atmosphere_shader, atmosphere_shader.lightUniforms);
		// RenderModels(fboHdrMipBlur, false, time, Camera, [AtmoSphereModel]);
		
		//gen mipmapa za renderirani color buffer
		glext.CFramebuffer.CopyTextureFromFBColorAttachment(txfbHdrMipBlur, 0, txfbColor, 0, MipGen.framebuffer, true);
		MipGen.Generate(txfbHdrMipBlur);
		
		gl.viewport(0, 0, txfbColor.width, txfbColor.height);
		
			fbo.AttachTexture(txfbColor, 0);
			RenderModels(fbo, false, time, Camera, [modelGlass]);
		
		//render to main FB, sa shaderom koji prikazuje mipove.
		glext.CFramebuffer.BindMainFB();	
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		
		backbuffer_shader.Bind();
		
			// guad_model.BindTexturesToShader(backbuffer_shader);
			txfbColor.Bind(0, backbuffer_shader.ULTextureD);
			
			backbuffer_shader.setViewMatrixUniform( IdentityMatrix );
			backbuffer_shader.setProjectionMatrixUniform( IdentityMatrix );
			backbuffer_shader.setTimeUniform(time);
			backbuffer_shader.setCameraPositionUniform(Camera.Position);
			
			quad_model.RenderIndexedTriangles(backbuffer_shader);
		
		sys.mouse.Update();
		gl.flush();
		gs.Update();
		bUpdateCamera = false;
		
		// transparent_shader.setFloat3Uniform(transparent_shader.ULroughnessScaleOffsetPower, [0.55+ctime*0.1,0.25,1.0]);
	}
	
	return; /* */
}

function RenderModels(fbo, bClearFBO, time, camera, models){
	
	if(fbo != null){
		fbo.Bind();
		gl.viewport(0, 0, fbo.width, fbo.height);
	}
	
	if(bClearFBO == true){ gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);}
	
	for(var m = 0; m < models.length; ++m){
		var model = models[m];
		var shader = glext.CShaderList.get(model.shaderID);
		
		if(fbo != null) fbo.ActivateDrawBuffers(shader);
		
		shader.Bind();
		
			model.BindTexturesToShader(shader);
		
			shader.setViewMatrixUniform( camera.ViewMatrix );
			shader.setProjectionMatrixUniform( camera.ProjectionMatrix );
			shader.setCameraPositionUniform(camera.Position);
			shader.setTimeUniform(time);
			
			model.RenderIndexedTriangles(shader);
	}
}


export function recompileShader(fragment_name){
	if(gl == null) return;
	
	for(var i = 0; i < glext.CShaderList.count(); ++i)
	{
		var shader = glext.CShaderList.get(i);
		if(shader.FragmentShaderName == fragment_name)
		{
			shader.Recompile();
			shader.InitDefaultAttribLocations();
			shader.InitDefaultUniformLocations();
			
			switch(fragment_name){
				case "transparent_shader":
					shader.ULTextureAmb = shader.getUniformLocation("txAmbient");
					shader.ULTextureBackground = shader.getUniformLocation("txBackground");
					shader.ULroughnessScaleOffsetPower = shader.getUniformLocation("roughnessScaleOffsetPower");
					glext.CLightList.get(0).AttachUniformBlockTo(shader);
				break;
				case "deferred_opaque_shader":
					shader.ULInvViewProjMatrix = shader.getUniformLocation("InverseViewProjectionMatrix");
					shader.ULCameraForwardDir = shader.getUniformLocation("CameraForwardDir");
					shader.ULCameraRightDir = shader.getUniformLocation("CameraRightDir");
					shader.ULCameraUpDir = shader.getUniformLocation("CameraUpDir");
					glext.CLightList.get(0).AttachUniformBlockTo(shader);
					
					shader.ULTextureAmb = shader.getUniformLocation("txAmbient");
					shader.ULTextureDiffuseGamma = shader.getUniformLocation("txDiffuse_gamma_value");
					shader.ULTextureNormalGamma = shader.getUniformLocation("txNormal_gamma_value");
					shader.ULTextureAoRSGamma = shader.getUniformLocation("txAoRS_gamma_value");
					shader.ULRoughnessScaleOffsetPower = shader.getUniformLocation("roughnessScaleOffsetPower");
					shader.ULEmissionMult = shader.getUniformLocation("emissionMult");
	
					shader.setFloatUniform(shader.ULTextureDiffuseGamma, 2.2);
					shader.setFloatUniform(shader.ULTextureNormalGamma, 1.0);
					shader.setFloatUniform(shader.ULTextureAoRSGamma, 2.2);
					shader.setFloatUniform(shader.ULEmissionMult, 0.0);
					shader.setFloat3Uniform(shader.ULRoughnessScaleOffsetPower, [2.75,0.0,1.0]);
				break;
				case "deferred_BcNAoRSMt":
					shader.ULTextureAmb = shader.getUniformLocation("txAmbient");
				break;
				case "atmosphere_shader":
					// shader.lightUniforms = glext.CLight.getUniformLocationsFromShader(shader, "light0");
					glext.CLightList.get(0).AttachUniformBlockTo(shader);
				break;
				default: break;
			}
			
			break;
		}
	}	
}


export function reloadTexture(texture_name){
	if(gl == null) return;
	
	for(var i = 0; i < glext.CTextureList.count(); ++i)
	{
		var texture = glext.CTextureList.get(i);
		if(texture.name == texture_name){
			texture.Reload();
			break;
		}
	}
}

function checkWindowsSizeAndResizeCanvas(){
	if(gl == null) return false;
	
	var wOmjer = gl.viewportWidth / window.innerWidth;
	var hOmjer = gl.viewportHeight / window.innerHeight;
	
	if(vMath.floatEqual(wOmjer, 1.0, 0.05) == true && vMath.floatEqual(hOmjer, 1.0, 0.05) == true) return false;

	glext.ResizeCanvas(window.innerWidth, window.innerHeight);	
	return true;
}