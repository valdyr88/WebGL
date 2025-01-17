import * as glext from "./../../GLExt/GLExt.js"
import * as sys from "./../../System/sys.js"
import * as vMath from "./../../glMatrix/gl-matrix.js";
import * as command from "./command.js"

//------------------------------------------------------------------------------------------
/*
paintable layer
	brine se za crtanje po layeru.
	shader se predaje u Begin() funkciji, i poziva se shader.BindUniforms(). (treba ju kreirat za shader)
	zatim se poziva Draw() koji zove shader.UpdateUniforms()
	kad se zavrsi crtanje potrebno je pozvati End().
	Begin() funkcija vraca kopiju (za undo) trenutnog stanja teksture koja se crta
*/
//------------------------------------------------------------------------------------------

export class CPaintableRasterLayer extends command.ICommandExecute{
	
	static bIsBytePrecision(precision){
		return precision == "byte" || precision == "8" || precision == "8bit" || precision == "uint8";
	}
	static bIsFloat32Precision(precision){
		return precision == "float" || precision == "float32";
	}
	
	static CreateTexture(texture, width, height, precision, components){
		
		switch(components)
		{
			case "r":
			case "1":
			case "a":
			case "g":{
				if(CPaintableRasterLayer.bIsBytePrecision(precision) == true)
					texture.CreateEmptyRubyte(width, height);
				else if(CPaintableRasterLayer.bIsFloat32Precision(precision) == true)
					texture.CreateEmptyRfloat32(width, height);
				break;
			}
			case "rg":
			case "2":
			case "xy":{
				if(CPaintableRasterLayer.bIsBytePrecision(precision) == true)
					texture.CreateEmptyRGubyte(width, height);
				else if(CPaintableRasterLayer.bIsFloat32Precision(precision) == true)
					texture.CreateEmptyRGfloat32(width, height);
				break;
			}
			case "rgb":
			case "3":
			case "xyz":{
				if(CPaintableRasterLayer.bIsBytePrecision(precision) == true)
					texture.CreateEmptyRGBubyte(width, height);
				else if(CPaintableRasterLayer.bIsFloat32Precision(precision) == true)
					texture.CreateEmptyRGBfloat32(width, height);
				break;
			}
			case "rgba":
			case "4":
			case "xyzw":{
				if(CPaintableRasterLayer.bIsBytePrecision(precision) == true)
					texture.CreateEmptyRGBAubyte(width, height);
				else if(CPaintableRasterLayer.bIsFloat32Precision(precision) == true)
					texture.CreateEmptyRGBAfloat32(width, height);
				break;
			}
		}
	}
	
	constructor(w, h, precision, components){
		super();
		this.setType("CPaintableRasterLayer");
		this.width = w;
		this.height = h;
		this.shader = null; //predaje se u funkciji Begin() i brise u End()
		this.framebuffer0 = new glext.CFramebuffer(false); this.framebuffer0.Create();
		this.precision = precision;
		this.components = components;
		this.texture0 = new glext.CTexture(-1);
		CPaintableRasterLayer.CreateTexture(this.texture0, this.width, this.height, this.precision, this.components);
		
		this.framebuffer0.AttachTexture(this.texture0, 0);
		this.framebuffer0.SetupUsage();
		
		this.texture = this.texture0;
		this.framebuffer = this.framebuffer0;
	}
	
	CopyIntoTexture(tx, xoffset, yoffset, w, h){
		
		let x = 0; let y = 0;
		if(xoffset < 0){ x = -xoffset; xoffset = 0; }
		if(yoffset < 0){ y = -yoffset; yoffset = 0; }
		
		this.framebuffer.Bind();
		glext.gl.readBuffer(glext.gl.COLOR_ATTACHMENT0);
		
		glext.gl.activeTexture(glext.gl.TEXTURE0);
		glext.gl.bindTexture(glext.gl.TEXTURE_2D, tx.texture);
		glext.gl.copyTexSubImage2D(glext.gl.TEXTURE_2D, 0, xoffset, yoffset, x, y, w, h);
		
		glext.gl.bindTexture(glext.gl.TEXTURE_2D, null);
	}
	
	CloneTexture(){
		
		var new_texture = new glext.CTexture(-1);
		CPaintableRasterLayer.CreateTexture(new_texture, this.width, this.height, this.precision, this.components);
		this.CopyIntoTexture(new_texture, 0, 0, this.width, this.height);
		return new_texture;
	}
	
	//ToDo:
	ResizeCanvas(dleft, dright, dup, ddown){
		
		let w = this.width + dleft + dright;
		let h = this.height + dup + ddown;
		
		var new_texture = new glext.CTexture(-1);
		CPaintableRasterLayer.CreateTexture(new_texture, w, h, this.precision, this.components);
		
		this.CopyIntoTexture(new_texture, dleft, dup, Math.min(w, this.width), Math.min(h, this.height));
		
		this.texture.Delete();
		this.texture = new_texture;
		this.width = w;
		this.height = h;
		this.texture0 = this.texture;
		
		this.framebuffer0.AttachTexture(this.texture0, 0);
		this.framebuffer0.SetupUsage();
	}
	
	Begin(shader){
		this.shader = shader;
		
		this.framebuffer.Bind();
		
		glext.gl.viewport(0, 0, this.width, this.height);
		
		this.shader.Bind();
		this.shader.BindUniforms();
	}
	 
	Draw(){		
		this.shader.UpdateUniforms();
		
		glext.NDCQuadModel.RenderIndexedTriangles(this.shader);
	}
	
	End(){
		this.shader = null;
	}
	
	Delete(){
		this.texture0.Delete();
		this.texture = null;
		this.framebuffer.Delete();
		this.framebuffer = null;
	}
	
	Clear(rgba){
		glext.gl.viewport(0, 0, this.width, this.height);
		this.framebuffer.Bind();
		glext.gl.clearColor(rgba[0],rgba[1],rgba[2],rgba[3]);
		glext.gl.clear(glext.gl.COLOR_BUFFER_BIT);
		glext.CFramebuffer.BindMainFB();
	}
}

//------------------------------------------------------------------------------------------

export class CDoubleBufferPaintableRasterLayer extends CPaintableRasterLayer{
	
	constructor(w, h, precision, components){
		super(w, h, precision, components);
		this.setType("CDoubleBufferPaintableRasterLayer");
		this.shader = null; //predaje se u funkciji Begin() i brise u End()
		this.framebuffer1 = new glext.CFramebuffer(false); this.framebuffer1.Create();
		// this.texture0 = new glext.CTexture(-1);
		this.texture1 = new glext.CTexture(-1);
		// CPaintableRasterLayer.CreateTexture(this.texture0, this.width, this.height, this.precision, this.components);
		CPaintableRasterLayer.CreateTexture(this.texture1, this.width, this.height, this.precision, this.components);
				
		this.framebuffer1.AttachTexture(this.texture1, 0);
		this.framebuffer1.SetupUsage();
		
		// this.texture = this.texture0;
		this.texture_old = this.texture1;
		this.framebuffer_old = this.framebuffer1;
	}
	
	CopyIntoTexture(tx, xoffset, yoffset, w, h){
		
		let x = 0; let y = 0;
		if(xoffset < 0){ x = -xoffset; xoffset = 0; }
		if(yoffset < 0){ y = -yoffset; yoffset = 0; }
		
		this.framebuffer.Bind();
		glext.gl.readBuffer(glext.gl.COLOR_ATTACHMENT0);
		
		glext.gl.activeTexture(glext.gl.TEXTURE0);
		glext.gl.bindTexture(glext.gl.TEXTURE_2D, tx.texture);
		glext.gl.copyTexSubImage2D(glext.gl.TEXTURE_2D, 0, xoffset, yoffset, x, y, w, h);
		
		glext.gl.bindTexture(glext.gl.TEXTURE_2D, null);
	}
	
	CloneTexture(){
		
		var new_texture = new glext.CTexture(-1);
		CPaintableRasterLayer.CreateTexture(new_texture, this.width, this.height, this.precision, this.components);
		this.CopyIntoTexture(new_texture, 0, 0, this.width, this.height);
		return new_texture;
	}
	
	//ToDo:
	ResizeCanvas(dleft, dright, dup, ddown){
		
		let w = this.width + dleft + dright;
		let h = this.height + dup + ddown;
		
		var new_texture = new glext.CTexture(-1);
		CPaintableRasterLayer.CreateTexture(new_texture, w, h, this.precision, this.components);
		
		this.CopyIntoTexture(new_texture, dleft, dup, Math.min(w, this.width), Math.min(h, this.height));
		
		this.texture.Delete();
		this.texture = new_texture;
		this.framebuffer.AttachTexture(this.texture, 0);
		this.framebuffer.SetupUsage();
		
		this.width = w;
		this.height = h;
		
		this.texture_old.Delete();
		this.texture_old = this.CloneTexture();
		this.framebuffer_old.AttachTexture(this.texture_old, 0);
		this.framebuffer_old.SetupUsage();
		
		this.texture0 = this.texture;
		this.texture1 = this.texture_old;
	}
	
	SwapOldNew(){
		let tmp = this.texture;
		this.texture = this.texture_old;
		this.texture_old = tmp; tmp = null;
		
		tmp = this.framebuffer;
		this.framebuffer = this.framebuffer_old;
		this.framebuffer_old = tmp; tmp = null;
	}
	
	Begin(shader){
		this.shader = shader;
		
		glext.gl.viewport(0, 0, this.width, this.height);
		
		this.shader.Bind();
		this.shader.BindUniforms();
	}
	
	Draw(){
		this.SwapOldNew();
		
		this.framebuffer.Bind();
		
		this.shader.UpdateUniforms();
		this.texture_old.Bind(0, this.shader.ULTextureD);
		
		glext.NDCQuadModel.RenderIndexedTriangles(this.shader);
	}
	
	End(){
		this.shader = null;
	}
	
	Delete(){
		this.texture0.Delete();
		this.texture1.Delete();
		this.texture0 = null;
		this.texture1 = null;
		this.texture = null;
		this.texture_old = null;
		this.framebuffer1.Delete();
		this.framebuffer1 = null;
		this.framebuffer2.Delete();
		this.framebuffer2 = null;
		this.framebuffer = null;
	}
	
	ClearRGBA(rgba){
		glext.gl.viewport(0, 0, this.width, this.height);
		glext.gl.clearColor(rgba[0],rgba[1],rgba[2],rgba[3]);
		this.framebuffer0.Bind();
		glext.gl.clear(glext.gl.COLOR_BUFFER_BIT);
		this.framebuffer1.Bind();
		glext.gl.clear(glext.gl.COLOR_BUFFER_BIT);
		glext.CFramebuffer.BindMainFB();
	}
	
	Clear(){
		if(arguments.length == 0)
			this.ClearRGBA([0.0,0.0,0.0,0.0]);
		else if(arguments.length == 1) //assuming the argument is an array
			this.ClearRGBA(arguments[0]);
		else if(arguments.length == 4)
			this.ClearRGBA([arguments[0],arguments[1],arguments[2],arguments[3]]);
	}
}

//------------------------------------------------------------------------------------------

export class CLayer extends command.ICommandExecute{
	
	constructor(){
		super();
		this.setType("CLayer");
		this.blendMode; //= new CBlendMode();
		this.type = "layer";
		this.paint_layer = null;
	}
	
	setBlendMode(){}
	
	getPaintLayer(){ return this.paint_layer; }
	
	Delete(){
		if(this.paint_layer != null){
			this.paint_layer.Delete();
			this.paint_layer = null;
		}
	}
}

export class CRasterLayer extends CLayer{
	
	constructor(w, h){
		super();
		this.setType("CRasterLayer");
		this.type = "raster";
		this.paint_layer = new CDoubleBufferPaintableRasterLayer(w, h, "byte", "rgba");
		this.paint_layer.Clear([0.0,0.0,0.0,0.0]);
	}
	
	ResizeCanvas(dleft, dright, dup, ddown){
		if(this.paint_layer != null) this.paint_layer.ResizeCanvas(dleft, dright, dup, ddown);
	}
}

export class CVectorLayer extends CLayer{
	
	constructor(w, h){
		super();
		this.setType("CVectorLayer");
		this.type = "vector"
	}
	
}

/*

- dokument sadrzi layere. 
	za prikaz iscrtava sve aktivne layere (applajajuci pri tome blend modove layera). 
	radi optimizacije "collapsa" sve aktivne layereu teksturu i to tako da svi layeri iznad trenutno slektiranog
	(onog kojeg ce se editirati), "collapsa" u jednu teksturu, a sve ispod selektiranog u drugu teksturu. pri iscrtavanju
	tada prikazuje gornju "collaps" teksturu, selektirani layer, i donju "collaps teksturu". 

*/