import * as glext from "./../../GLExt/GLExt.js"
import * as sys from "./../../System/sys.js"
import * as vMath from "./../../glMatrix/gl-matrix.js";
import * as ui from "./ui.js"

import { CLayer, CRasterLayer, CVectorLayer } from "./layer.js";

class CLayerRenderer{
	
	/*
		
	*/
	
	constructor(){
		this.framebuffer = new glext.CFramebuffer(false); this.framebuffer.Create();
		this.quad_model = new glext.CModel(-1);
		glext.GenQuadModel(this.quad_model);
	}
	
	RenderLayer(shader){
		
	}
}

class CCursor{
	
	constructor(w, h){
		this.width = w;
		this.height = h;
		this.X = 0.0;
		this.Y = 0.0;
		this.x = 0.0;
		this.y = 0.0;
		this.Pos = [0.0,0.0];
		this.pos = [0.0,0.0];
	}
	
	set(posX, posY){
		this.X = posX;
		this.Y = posY;
		this.x = this.X / this.width;
		this.y = this.Y / this.height;
		this.Pos = [this.X, this.Y];
		this.pos = [this.x, this.y];
	}
}

export class CDocument extends ui.CGUIElement{
	
	constructor(id){
		super();
		
		++CDocument.createdCount;
		
		if(id != null){
			this.htmlObj = document.getElementById(id);
			this.id = id;
			//ToDo: init width/height from htmlObj
			this.width = 0;
			this.height = 0;
		}
		else{
			this.htmlObj = null;
			this.id = "document_file_" + CDocument.createdCount.toString();
			this.width = 0;
			this.height = 0;
		}
		
		this.layers = [];
		// this.canvas = CanvasHandler.CreateHandle();
		this.editingID = 0; //id layera u listi layers koji se trenutno editira
		
		this.paintCanvas = null;
		// this.parentCDocument = null;
		
		this.activeLayerID = 0;
		
		this.brush = null;
		this.cursor = null;
	}
	
	setBrush(brsh){
		this.brush = brsh;
	}
	
	clearBrush(){
		this.brush = null;
	}
	
	CreateFromDOM(dom, caller){
		let _this = (caller == null || caller == undefined)? this : caller;
		super.CreateFromDOM(dom, _this);
		
		this.setZIndex( ui.CGUIElement.zIndex_Document );
	}
	
	CollapseForDisplay(){
		//collapsat layere od 0 - editingID-1 u donju teksturu, a editingID+1 do layers.length-1 u gornju.
	}
	
	CreateLayerExt(type, w, h){
		if(type == "raster"){ this.layers[this.layers.length] = new CRasterLayer(w, h); } else
		if(type == "vector"){ this.layers[this.layers.length] = new CVectorLayer(w, h); }
	}
	
	CreateLayer(type){
		this.CreateLayerExt(type, this.width, this.height); }
	
	getDOM(){ return this.htmlObj; }
	
	setSize(w, h){
		let sizeobj = sys.utils.getGrandchild(this.htmlObj, CDocument.ids_to_size);
		sizeobj.style.width = (w + 32).toString() + "px";
		sizeobj.style.height = (h + 32).toString() + "px";
		this.width = w;
		this.height = h;
		this.cursor = new CCursor(w, h);
	}
	
	CreateNew(w, h){
		
		this.width = w;
		this.height = h;
		
		//load html file and create dom elements from it (callback function)
		sys.html.CreateDOMFromHTMLFile(this, "./windows/document.html", function(_this, obj){
			_this.htmlObj = document.createElement('div');
			_this.htmlObj.id = _this.id;
			_this.htmlObj.appendChild(obj);
			
			_this.CreateFromDOM(_this.htmlObj, _this);
			_this.htmlObj.uiObj = _this;
		
			_this.setSize(w, h);
			
			document.body.appendChild(_this.htmlObj);
			
			_this.htmlObj.style.position = "absolute";
			// _this.htmlObj.onclick = document.window.document_onclick(_this.id);
			
			_this.htmlObj.AttachGLCanvas = _this.AttachGLCanvas;
			// _this.htmlObj.onclick = _this.AttachGLCanvas;
			_this.addOnClick(_this);
			
			sys.html.MakeElementMovable(_this.htmlObj, "data-movable-element-handle");
		});
	}
	
	getActivePaintLayer(){ return this.layers[this.activeLayerID].getPaintLayer(); }
	
	BringToFront(){
		this.uiObj.setZIndex( ui.CGUIElement.zIndex_Document+1 );
	}
	
	onClick(){
		this.htmlObj.AttachGLCanvas();
	}
	
	RenderVisibleLayersToCanvas(){
		let shader = glext.NDCQuadModel.mainDisplayShader;
		glext.CFramebuffer.BindMainFB();	
		glext.gl.viewport(0, 0, glext.gl.viewportWidth, glext.gl.viewportHeight);
		glext.gl.clearColor(0.0,0.0,0.0,1.0);
		glext.gl.clear(glext.gl.COLOR_BUFFER_BIT | glext.gl.DEPTH_BUFFER_BIT);
		
		shader.Bind();
			this.getActivePaintLayer().texture.Bind(0, shader.ULTextureD);
			glext.NDCQuadModel.RenderIndexedTriangles(shader);
	}
		
	getHMTLImageFromCanvas(){
		this.RenderVisibleLayersToCanvas();				
		let img = document.createElement('img');
		img.src = glext.gl.canvasObject.toDataURL();
		return img;
	}
	
	AddHTMLImage(htmlImg){
		htmlImg.id = this.id + "_img";
		// htmlImg.style.position = "absolute";
		htmlImg.style = glext.gl.canvasObject.style;
		let obj = sys.utils.getGrandchild(this.htmlObj, CDocument.ids_to_paint_area);
		obj.appendChild(htmlImg);
	}
	
	RemoveHTMLImage(){
		let obj = sys.utils.getGrandchild(this.htmlObj, CDocument.ids_to_paint_area);
		let i = sys.utils.getChildPosition(obj, this.id + "_img");
		if(i != -1)
			obj.removeChild(obj.childNodes[i]);
	}
	
	ResizePaintCavas(){
		if(this.paintCanvas == null) return;
		
		if(this.paintCanvas.width != this.width || this.paintCanvas.height != this.height){
			this.paintCanvas.width = this.width;
			this.paintCanvas.height = this.height;
			glext.ResizeCanvas(this.width, this.height);
			
			let dw = this.width - this.getActivePaintLayer().width;
			let dh = this.height - this.getActivePaintLayer().height;
			
			this.getActivePaintLayer().ResizeCanvas(Math.floor(dw/2.0), Math.floor(dw/2.0), Math.ceil(dh/2.0), Math.ceil(dh/2.0));
		}
	}
	
	AttachGLCanvas(){
		//this function operates on htmlObj from CDocument (this ptr is htmlObj)
		let gl = glext.gl;
		if(gl == null) return;
		// assert(CDocuments.Count() != 0);
		if(CDocuments.getActive() === this.uiObj) return;
		
		if(CDocuments.Count() > 1){
			
			let obj = sys.utils.getGrandchild(this, CDocument.ids_to_paint_area);
			let objtwo = gl.canvasObject.parentNode;
			let objtwoChildPos = sys.utils.getChildPosition(objtwo, CDocument.id_paint_canvas);
			let oldCanvasObject = sys.utils.getChild(obj, CDocument.id_paint_canvas);
			let doctwo = sys.utils.getGrandparent(gl.canvasObject, CDocument.ids_to_paint_area_reversed).parentNode;
			
			let htmlImg = doctwo.uiObj.getHMTLImageFromCanvas();
			doctwo.uiObj.AddHTMLImage(htmlImg);
			
			//replaceChild( new, old );
			obj.replaceChild(gl.canvasObject, oldCanvasObject);
			if(objtwoChildPos != -1) objtwo.insertBefore(oldCanvasObject, objtwo.children[objtwoChildPos]);
				
			//add mous functions to paint document object
			this.baseWindowOffset = [gl.canvasObject.offsetLeft, gl.canvasObject.offsetTop];
			
			this.transformMouseCoords = function(pos){
				pos[0] = pos[0] - this.baseWindowOffset[0];
				pos[1] = pos[1] - this.baseWindowOffset[1];
			}
			
			// gl.activeDoc = this;
			CDocuments.setActive(this.uiObj);
			
			this.uiObj.paintCanvas = gl.canvasObject;
			doctwo.uiObj.paintCanvas = null;
			this.uiObj.ResizePaintCavas();
			this.uiObj.RenderVisibleLayersToCanvas();
			this.uiObj.RemoveHTMLImage();
			
			//set to front
			this.uiObj.setZIndex( ui.CGUIElement.zIndex_Document );
			//set to back
			doctwo.uiObj.setZIndex( ui.CGUIElement.zIndex_ToBack );
		}
		else if(CDocuments.Count() == 1){
			
			let obj = sys.utils.getGrandchild(this, CDocument.ids_to_paint_area);
			let oldCanvasObject = sys.utils.getChild(obj, CDocument.id_paint_canvas);

			obj.replaceChild(gl.canvasObject, oldCanvasObject);
			this.baseWindowOffset = [gl.canvasObject.offsetLeft, gl.canvasObject.offsetTop];
			
			this.transformMouseCoords = function(pos){
				pos[0] = pos[0] - this.baseWindowOffset[0];
				pos[1] = pos[1] - this.baseWindowOffset[1];
			}
			
			CDocuments.setActive(this.uiObj);
			
			this.uiObj.paintCanvas = gl.canvasObject;
			this.uiObj.setZIndex( ui.CGUIElement.zIndex_Document );
		}
	}
	
	getPaintCanvas(){ return this.paintCanvas; }
	
//----------------------------------------------------------------------
//	Update()
//----------------------------------------------------------------------
	
	updateCursor(X, Y){
		if(this.cursor == null) return;
		let pos = [X, Y];
		this.uiObj.paintCanvas.transformMouseCoords(pos);
		this.cursor.set(pos[0], pos[1]);
	}
	
	updateBrush(bPressed){
		if(this.brush == null) return;
		if(this.cursor == null) return;
		
		if(bPressed == false){
			this.brush.setColor(0.0,0.0,0.0);
		}
		else{
			let time = sys.time.getFrameTime();
			let dTime = sys.time.getAvgDeltaTime();
			
			this.brush.setPosition( this.cursor.pos );
			this.brush.setColor(Math.cos(time)*0.5+0.5, Math.sin(time)*0.5+0.5, 1.0-Math.sin(time)*0.5+0.5);
			this.brush.setDeltaTime(Math.min(dTime, 1.0/15.0));
			this.brush.setRandom(Math.random());
		}
		this.brush.Update();
	}
	
	updateLayers(){
		//updating of all layers
		for(let i = 0; i < this.layers.length; ++i){
			let layer = this.layers[i].getPaintLayer();
			if(layer != null){
				layer.Begin(this.brush.shader);
				layer.Draw();
				layer.End();
			}
		}
	}
	
	Update(X, W, bPressed){
		this.updateCursor(X, W);
		this.updateBrush(bPressed);
		this.updateLayers();
	}
	
//----------------------------------------------------------------------
	
	Delete(){
		for(let i = 0; i < this.layers.length; ++i){
			this.layers[i].Delete();
			this.layers[i] = null;
		}
		this.layers = [];
	}
}

CDocument.createdCount = 0;
CDocument.ids_to_paint_area = ["panelmain","document_size","document_display_grid","document_paint_area"];
CDocument.ids_to_paint_area_reversed = ["document_paint_area","document_display_grid","document_size","panelmain"];
CDocument.id_paint_canvas = "document_paint_canvas";
CDocument.ids_to_size = ["panelmain","document_size"];

export class CDocuments{
	
	constructor(){
	}
	
	static CreateDocument(w,h){
		let doc = new CDocument(null);
		CDocuments.documents[CDocuments.documents.length] = doc;
		doc.CreateNew(w,h);
		return doc;
	}
	
	static setActive(doc){
		CDocuments.activeDoc = doc;
	}
	
	static Count(){ return CDocuments.documents.length; }
	
	static getActive(){ return CDocuments.activeDoc; }
}

CDocuments.documents = [];
CDocuments.activeDoc = null;
