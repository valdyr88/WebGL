import * as glext from "./../../GLExt/GLExt.js"
import * as sys from "./../../System/sys.js"
import * as vMath from "./../../glMatrix/gl-matrix.js";

/*
paintable layer
	brine se za crtanje po layeru.
	shader se predaje u Begin() funkciji, i poziva se shader.BindUniforms(). (treba ju kreirat za shader)
	zatim se poziva Draw() koji zove shader.UpdateUniforms()
	kad se zavrsi crtanje potrebno je pozvati End().
	Begin() funkcija vraca kopiju (za undo) trenutnog stanja teksture koja se crta
	
	
	ToDo:
		- napravit kloniranje texture za undo (funkcija CloneTexture())
		- testirat Begin() Draw() End() na testnom shaderu.
		- inicijalizirat u mainu NDCQuadModel.
*/
export class PaintableRasterLayer{
	
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
				if(PaintableRasterLayer.bIsBytePrecision(precision) == true)
					texture.CreateEmptyRubyte(width, height);
				else if(PaintableRasterLayer.bIsFloat32Precision(precision) == true)
					texture.CreateEmptyRfloat32(width, height);
				break;
			}
			case "rg":
			case "2":
			case "xy":{
				if(PaintableRasterLayer.bIsBytePrecision(precision) == true)
					texture.CreateEmptyRGubyte(width, height);
				else if(PaintableRasterLayer.bIsFloat32Precision(precision) == true)
					texture.CreateEmptyRGfloat32(width, height);
				break;
			}
			case "rgb":
			case "3":
			case "xyz":{
				if(PaintableRasterLayer.bIsBytePrecision(precision) == true)
					texture.CreateEmptyRGBubyte(width, height);
				else if(PaintableRasterLayer.bIsFloat32Precision(precision) == true)
					texture.CreateEmptyRGBfloat32(width, height);
				break;
			}
			case "rgba":
			case "4":
			case "xyzw":{
				if(PaintableRasterLayer.bIsBytePrecision(precision) == true)
					texture.CreateEmptyRGBAubyte(width, height);
				else if(PaintableRasterLayer.bIsFloat32Precision(precision) == true)
					texture.CreateEmptyRGBAfloat32(width, height);
				break;
			}
		}
	}
			
	constructor(w, h, precision, components){
		this.width = w;
		this.height = h;
		this.shader = null; //predaje se u funkciji Begin() i brise u End()
		this.framebuffer = new glext.Framebuffer(false); this.framebuffer.Create();
		this.precision = precision;
		this.components = components;
		this.texture = new glext.Texture(-1);
		PaintableRasterLayer.CreateTexture(this.texture, this.width, this.height, this.precision, this.components);
	}
	
	CloneTexture(){
		
		var new_texture = new glext.Texture(-1);
		
		PaintableRasterLayer.CreateTexture(new_texture, this.width, this.height, this.precision, this.components);
		//ToDo: ovdje kopirat
		this.framebuffer.Bind();
		this.framebuffer.AttachTexture(this.texture, 0);
		this.framebuffer.SetupUsage();
		glext.gl.readBuffer(glext.gl.COLOR_ATTACHMENT0);
		
		glext.gl.activeTexture(glext.gl.TEXTURE0);
		glext.gl.bindTexture(glext.gl.TEXTURE_2D, new_texture.texture);
		
		// glext.gl.copyTextureSubImage2D(this.texture.texture, 0, 0, 0, 0, 0, this.width, this.height);
		glext.gl.copyTexSubImage2D(glext.gl.TEXTURE_2D, 0, 0, 0, 0, 0, this.width, this.height);
		
		this.framebuffer.DetachAllTextures();
		
		return new_texture;
	}
	
	Begin(shader){
		this.shader = shader;
		
		this.framebuffer.Bind();
		this.framebuffer.AttachTexture(this.texture, 0);
		this.framebuffer.SetupUsage();
		
		glext.gl.viewport(0, 0, this.width, this.height);
		
		this.shader.Bind();
		this.shader.BindUniforms();
	}
	
	Draw(){
		this.shader.UpdateUniforms();
		glext.NDCQuadModel.RenderIndexedTriangles(this.shader);
	}
	
	End(){
		this.framebuffer.DetachAllTextures();
		this.shader = null;
	}
}

export class Layer{
	
	constructor(w,h){
		this.blendMode; //= new BlendMode();
		this.width = w; this.height = h;
		this.type = "layer";
	}
	
	setBlendMode(){}
}

export class RasterLayer extends Layer{
	
	constructor(w, h){
		super(w,h);
		this.type = "raster";
		this.paint_layer = new PaintableRasterLayer(w, h, "byte", "rgb");
	}
}

export class VectorLayer extends Layer{
	
	constructor(w, h){
		super(w,h);
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