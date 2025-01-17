import { gl, getContentsFromFile, glPrintError, CGLExtObject } from "./glContext.js";
import { CShader, CShaderList } from "./glShader.js";
import * as vMath from "../glMatrix/gl-matrix.js";

export class CCamera extends CGLExtObject{
	
	constructor(slotID, viewWidth, viewHeight)
	{
		super();
		this.SlotID = slotID;
		this.ViewMatrix = vMath.mat4.create();
		this.ProjectionMatrix = vMath.mat4.create();
		this.InverseViewProjectionMatrix = vMath.mat4.create();
		this.InverseViewMatrix = vMath.mat4.create();
		this.InverseProjectionMatrix = vMath.mat4.create();
		this.bDoCalcInvView = false;
		this.bDoCalcInvProj = false;
		this.bDoCalcInvViewProj = false;
		this.Position = vMath.vec3.create();
		
		this.ForwardDir = vMath.vec3.create();
		this.UpDir = vMath.vec3.create();
		this.RightDir = vMath.vec3.create();
		
		this.FOV = 40.0;
		this.Near = 0.1;
		this.Far = 1000.0;
		this.Height = viewHeight;
		this.Width = viewWidth;
		this.PixelAspect = this.Width/this.Height;
		
		this.UpdateProjectionMatrix();
	}
	
	UpdateViewMatrix(){
		var centerPt = vMath.vec3.create();
		vMath.vec3.copy(centerPt, this.ForwardDir);
		// vMath.vec3.scale(centerPt, centerPt, 1000.0);
		// vMath.vec3.add(centerPt, centerPt, this.Position);
		vMath.vec3.scaleAndAdd(centerPt, this.Position, centerPt, 1000.0);
		
		vMath.mat4.lookAt(this.ViewMatrix, this.Position, centerPt, this.UpDir);
		this.bDoCalcInvView = true; this.bDoCalcInvViewProj = true;
	}
	
	UpdateProjectionMatrix(){
		vMath.mat4.perspective(this.ProjectionMatrix, vMath.deg2rad(this.FOV), this.PixelAspect, this.Near, this.Far);
		this.bDoCalcInvProj = true; this.bDoCalcInvViewProj = true;
	}
	
	Rotate(dx, dy){
		if(dx == 0.0 && dy == 0.0) return;
		
		var v = vMath.vec3.create();
		vMath.vec3.scale(v, this.RightDir, dx);
		vMath.vec3.add(this.ForwardDir, v, this.ForwardDir);
		vMath.vec3.scale(v, this.UpDir, dy);
		vMath.vec3.add(this.ForwardDir, v, this.ForwardDir);
		vMath.vec3.normalize(this.ForwardDir, this.ForwardDir);
		
		vMath.vec3.cross(this.UpDir, this.RightDir, this.ForwardDir);
		vMath.vec3.normalize(this.UpDir, this.UpDir);
		vMath.vec3.cross(this.RightDir, this.ForwardDir, this.UpDir);
		vMath.vec3.normalize(this.RightDir, this.RightDir);
		
		this.UpdateViewMatrix();
	}
	
	Tilt(dt){
		if(dt == 0.0) return;
		
		var v = vMath.vec3.create();
		vMath.vec3.scale(v, this.RightDir, dt);
		vMath.vec3.add(this.UpDir, v, this.UpDir);
		vMath.vec3.normalize(this.UpDir, this.UpDir);
		
		vMath.vec3.cross(this.RightDir, this.ForwardDir, this.UpDir);
		vMath.vec3.normalize(this.RightDir, this.RightDir);
		vMath.vec3.cross(this.ForwardDir, this.UpDir, this.RightDir);
		vMath.vec3.add(this.ForwardDir, v, this.ForwardDir);
		
		this.UpdateViewMatrix();
	}
	
	setPositionAndDir(position, forward, up){
		vMath.vec3.copy(this.ForwardDir, forward);
		vMath.vec3.normalize(this.ForwardDir, this.ForwardDir);
		vMath.vec3.copy(this.UpDir, up);
		vMath.vec3.normalize(this.UpDir, this.UpDir);
		vMath.vec3.cross(this.RightDir, this.ForwardDir, this.UpDir);
		vMath.vec3.normalize(this.RightDir, this.RightDir);
		vMath.vec3.cross(this.UpDir, this.RightDir, this.ForwardDir);
		vMath.vec3.normalize(this.UpDir, this.UpDir);
		vMath.vec3.copy(this.Position, position);
		this.UpdateViewMatrix();
	}
	
	setPositionAndLookPt(position, lookPt, up){
		vMath.vec3.subtract(lookPt, lookPt, position);
		this.setPositionAndDir(position, lookPt, up);
	}
	
	setForwardDir(dir){
		vMath.vec3.copy(this.ForwardDir, dir);
		vMath.vec3.normalize(this.ForwardDir, this.ForwardDir);
		vMath.vec3.cross(this.RightDir, this.ForwardDir, this.UpDir);
		vMath.vec3.normalize(this.RightDir, this.RightDir);
		vMath.vec3.cross(this.UpDir, this.RightDir, this.ForwardDir);
		vMath.vec3.normalize(this.UpDir, this.UpDir);
		this.UpdateViewMatrix();
	}
	
	setUpDir(dir){
		vMath.vec3.copy(this.UpDir, dir);
		vMath.vec3.normalize(this.UpDir, this.UpDir);
		vMath.vec3.cross(this.RightDir, this.ForwardDir, this.UpDir);
		vMath.vec3.normalize(this.RightDir, this.RightDir);
		vMath.vec3.cross(this.ForwardDir, this.UpDir, this.RightDir);
		vMath.vec3.normalize(this.ForwardDir, this.ForwardDir);
		this.UpdateViewMatrix();
	}
	
	setPosition(pos){
		vMath.vec3.copy(this.Position, pos);
		this.UpdateViewMatrix();
	}
	
	setFOV(fov){
		this.FOV = fov;
		this.UpdateProjectionMatrix();
	}
	
	setNearFar(near,far){
		this.Near = near; this.Far = far;
		this.UpdateProjectionMatrix();
	}
	
	setViewportWidthHeight(width,height){
		this.Height = height; this.Width = width;
		let newPixelAspect = this.Width/this.Height;
		
		if(newPixelAspect != this.PixelAspect){
			this.PixelAspect = newPixelAspect;
			this.UpdateProjectionMatrix();
		}
	}
	
	setShaderMatrices(shader){
		shader.setViewMatrixUniform( this.ViewMatrix );
		shader.setProjectionMatrixUniform( this.ProjectionMatrix );
	}
	setLightMatrices(light){
		light.setMatrices( this.ViewMatrix, this.ProjectionMatrix );
	}
	
	MoveForward(amount){
		var v = vMath.vec3.create();
		vMath.vec3.scale(v, this.ForwardDir, amount);
		vMath.vec3.add(this.Position, v, this.Position);
		this.UpdateViewMatrix();
	}
	
	MoveRight(amount){
		var v = vMath.vec3.create();
		vMath.vec3.scale(v, this.RightDir, amount);
		vMath.vec3.add(this.Position, v, this.Position);
		this.UpdateViewMatrix();
	}
	
	MoveUp(amount){
		var v = vMath.vec3.create();
		vMath.vec3.scale(v, this.UpDir, amount);
		vMath.vec3.add(this.Position, v, this.Position);
		this.UpdateViewMatrix();
	}
	
	CalcInverseViewProjectionMatrix(){
		if(this.bDoCalcInvViewProj == false) return;
		vMath.mat4.multiply(this.InverseViewProjectionMatrix, this.ProjectionMatrix, this.ViewMatrix);
		this.InverseViewProjectionMatrix = vMath.mat4.glInverse(this.InverseViewProjectionMatrix);
		this.bDoCalcInvViewProj = false;
	}
	
	CalcInverseViewMatrix(){
		if(this.bDoCalcInvView == false) return;
		this.InverseViewMatrix = vMath.mat4.glInverse(this.ViewMatrix);
		this.bDoCalcInvView = false;
	}
	CalcInverseProjectionMatrix(){
		if(this.bDoCalcInvProj == false) return;
		this.InverseProjectionMatrix = vMath.mat4.glInverse(this.ProjectionMatrix);
		this.bDoCalcInvProj = false;
	}
}