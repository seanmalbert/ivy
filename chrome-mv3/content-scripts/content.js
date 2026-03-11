var content=(function(){"use strict";function $(e){return e}function I(e){return typeof e=="object"&&e!==null&&"type"in e&&"payload"in e&&typeof e.type=="string"}const A={matches:["<all_urls>"],runAt:"document_idle",main(){let e=!0,t=null;function r(i){if(i.id)return`#${CSS.escape(i.id)}`;const n=[];let s=i;for(;s&&s!==document.body;){const o=s.tagName.toLowerCase(),c=s.parentElement;if(!c)break;const l=Array.from(c.children).filter(d=>d.tagName===s.tagName);if(l.length>1){const d=l.indexOf(s)+1;n.unshift(`${o}:nth-of-type(${d})`)}else n.unshift(o);s=c}return n.join(" > ")}function a(){const i=[];return(document.querySelector("main, [role='main'], article, .content, #content")??document.body).querySelectorAll("h1,h2,h3,h4,h5,h6,p,ul,ol,table").forEach(o=>{const c=o.textContent?.trim()??"";if(c.length<20||o.parentElement?.closest("ul,ol,table")&&(o.tagName==="UL"||o.tagName==="OL"))return;const l=o.tagName.toLowerCase();let d="unknown";l.startsWith("h")?d="heading":l==="p"?d="paragraph":l==="table"?d="table":(l==="ul"||l==="ol")&&(d="list"),i.push({selector:r(o),type:d,content:c.slice(0,2e3)})}),i}function p(){return{url:window.location.href,title:document.title,content:document.body.innerText.slice(0,5e4),regions:a()}}const y=new Map;let u=0;function M(i){if(u=0,!document.getElementById("ivy-transform-styles")){const n=document.createElement("style");n.id="ivy-transform-styles",n.textContent=`
          .ivy-simplified {
            border-left: 3px solid #7c3aed;
            padding-left: 8px;
            background: rgba(124, 58, 237, 0.04);
            color: #1f2937 !important;
            transition: background 0.3s;
          }
          .ivy-simplified:hover {
            background: rgba(124, 58, 237, 0.08);
          }
          .ivy-simplified::after {
            content: "Simplified by Ivy";
            display: block;
            font-size: 10px;
            color: #7c3aed;
            margin-top: 4px;
            font-family: system-ui, sans-serif;
            opacity: 0;
            transition: opacity 0.2s;
          }
          .ivy-simplified:hover::after {
            opacity: 1;
          }
          .ivy-tooltip {
            border-bottom: 1px dashed #7c3aed;
            cursor: help;
            position: relative;
          }
          .ivy-tooltip:hover::after {
            content: attr(data-ivy-tip);
            position: absolute;
            bottom: 100%;
            left: 0;
            background: #1f2937;
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.4;
            max-width: 280px;
            white-space: normal;
            z-index: 2147483647;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-family: system-ui, sans-serif;
          }
        `,document.head.appendChild(n)}for(const n of i)try{document.querySelectorAll(n.selector).forEach(o=>{switch(y.has(o)||y.set(o,o.innerHTML),n.action){case"replace":{/<[a-z][\s\S]*>/i.test(n.value)?o.innerHTML=n.value:o.textContent=n.value,o.classList.add("ivy-simplified"),u++;break}case"annotate":{const c=document.createElement("span");c.className="ivy-tooltip",c.setAttribute("data-ivy-tip",n.value),o.parentNode?.replaceChild(c,o),c.appendChild(o),u++;break}case"style":o.style.cssText+=n.value;break;case"remove":o.style.display="none",o.classList.add("ivy-simplified"),u++;break}})}catch{}chrome.runtime.sendMessage({type:"TRANSFORM_STATUS",payload:{status:"done",transformedCount:u,processingMs:0}}).catch(()=>{})}function w(){y.forEach((i,n)=>{n.innerHTML=i,n.classList.remove("ivy-simplified")}),y.clear(),u=0}function S(i){let n=document.getElementById("ivy-accessibility");n||(n=document.createElement("style"),n.id="ivy-accessibility",document.head.appendChild(n));const s=[];i.fontScale&&i.fontScale!==1&&s.push(`html { font-size: ${i.fontScale*100}% !important; }`),i.highContrast&&s.push(`
          body { color: #000 !important; background: #fff !important; }
          a { color: #1a0dab !important; }
          img { filter: contrast(1.2) !important; }
        `),i.reduceMotion&&s.push(`*, *::before, *::after {
          animation-duration: 0.001s !important;
          transition-duration: 0.001s !important;
        }`),n.textContent=s.join(`
`)}function P(i,n,s){f(),t=document.createElement("div"),t.id="ivy-ask-button",t.textContent="Ask Ivy",t.style.cssText=`
        position:fixed; left:${i}px; top:${n-40}px;
        background:#7c3aed; color:white; padding:6px 12px;
        border-radius:8px; font-size:13px; font-family:system-ui,sans-serif;
        cursor:pointer; z-index:2147483647;
        box-shadow:0 2px 8px rgba(0,0,0,0.2); user-select:none;
      `,t.addEventListener("click",()=>{const o=window.getSelection()?.anchorNode?.parentElement?.textContent?.slice(0,500)??"";t.textContent="Thinking...",t.style.opacity="0.7",t.style.pointerEvents="none",chrome.runtime.sendMessage({type:"HIGHLIGHT_ASK",payload:{selectedText:s,context:o}})}),document.body.appendChild(t)}function f(){t&&(t.remove(),t=null)}document.addEventListener("mouseup",i=>{if(t?.contains(i.target))return;const n=window.getSelection(),s=n?.toString().trim()??"";if(s.length>3&&e){const c=n?.getRangeAt(0)?.getBoundingClientRect();c&&P(c.left+c.width/2-30,c.top,s)}else f()}),document.addEventListener("mousedown",i=>{t&&!t.contains(i.target)&&f()}),chrome.runtime.onMessage.addListener((i,n,s)=>{if(I(i))switch(i.type){case"GET_PAGE_CONTENT":s({type:"PAGE_CONTENT",payload:p()});break;case"TRANSFORM_RESULT":M(i.payload.instructions);break;case"HIGHLIGHT_ANSWER":{f();const o=i.payload;C(o.answer);break}case"ERROR":f(),i.payload.code==="EXPLAIN_FAILED"&&C(i.payload.message);break;case"PREFERENCES_UPDATED":S(i.payload);break;case"TOGGLE_IVY":if(e=i.payload.enabled,!e){const o=document.getElementById("ivy-accessibility");o&&(o.textContent=""),w()}break;case"UNDO_TRANSFORMS":w();break}});function C(i){const n=document.getElementById("ivy-answer-tooltip");n&&n.remove();const c=window.getSelection()?.getRangeAt(0)?.getBoundingClientRect();if(!c)return;const l=document.createElement("div");l.id="ivy-answer-tooltip",l.style.cssText=`
        position:fixed;
        left:${Math.min(c.left,window.innerWidth-340)}px;
        top:${c.bottom+8}px;
        background:white; border:1px solid #e5e7eb; border-radius:12px;
        z-index:2147483647; box-shadow:0 4px 16px rgba(0,0,0,0.12);
        max-width:320px; padding:12px; font-size:14px; line-height:1.5;
        font-family:system-ui,sans-serif;
      `;const d=document.createElement("div");d.textContent=i,l.appendChild(d);const b=document.createElement("button");b.textContent="Close",b.style.cssText="display:block;margin-top:8px;margin-left:auto;background:none;border:none;color:#7c3aed;cursor:pointer;font-size:12px;",b.addEventListener("click",()=>l.remove()),l.appendChild(b),document.body.appendChild(l),setTimeout(()=>l.remove(),3e4)}chrome.storage.local.get("ivy_preferences",i=>{if(i.ivy_preferences)try{const n=JSON.parse(i.ivy_preferences);n?.state?.preferences&&S(n.state.preferences)}catch{}})}};function h(e,...t){}const N={debug:(...e)=>h(console.debug,...e),log:(...e)=>h(console.log,...e),warn:(...e)=>h(console.warn,...e),error:(...e)=>h(console.error,...e)},E=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;var x=class T extends Event{static EVENT_NAME=v("wxt:locationchange");constructor(t,r){super(T.EVENT_NAME,{}),this.newUrl=t,this.oldUrl=r}};function v(e){return`${E?.runtime?.id}:content:${e}`}const L=typeof globalThis.navigation?.addEventListener=="function";function k(e){let t,r=!1;return{run(){r||(r=!0,t=new URL(location.href),L?globalThis.navigation.addEventListener("navigate",a=>{const p=new URL(a.destination.url);p.href!==t.href&&(window.dispatchEvent(new x(p,t)),t=p)},{signal:e.signal}):e.setInterval(()=>{const a=new URL(location.href);a.href!==t.href&&(window.dispatchEvent(new x(a,t)),t=a)},1e3))}}}var R=class m{static SCRIPT_STARTED_MESSAGE_TYPE=v("wxt:content-script-started");id;abortController;locationWatcher=k(this);constructor(t,r){this.contentScriptName=t,this.options=r,this.id=Math.random().toString(36).slice(2),this.abortController=new AbortController,this.stopOldScripts(),this.listenForNewerScripts()}get signal(){return this.abortController.signal}abort(t){return this.abortController.abort(t)}get isInvalid(){return E.runtime?.id==null&&this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(t){return this.signal.addEventListener("abort",t),()=>this.signal.removeEventListener("abort",t)}block(){return new Promise(()=>{})}setInterval(t,r){const a=setInterval(()=>{this.isValid&&t()},r);return this.onInvalidated(()=>clearInterval(a)),a}setTimeout(t,r){const a=setTimeout(()=>{this.isValid&&t()},r);return this.onInvalidated(()=>clearTimeout(a)),a}requestAnimationFrame(t){const r=requestAnimationFrame((...a)=>{this.isValid&&t(...a)});return this.onInvalidated(()=>cancelAnimationFrame(r)),r}requestIdleCallback(t,r){const a=requestIdleCallback((...p)=>{this.signal.aborted||t(...p)},r);return this.onInvalidated(()=>cancelIdleCallback(a)),a}addEventListener(t,r,a,p){r==="wxt:locationchange"&&this.isValid&&this.locationWatcher.run(),t.addEventListener?.(r.startsWith("wxt:")?v(r):r,a,{...p,signal:this.signal})}notifyInvalidated(){this.abort("Content script context invalidated"),N.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){document.dispatchEvent(new CustomEvent(m.SCRIPT_STARTED_MESSAGE_TYPE,{detail:{contentScriptName:this.contentScriptName,messageId:this.id}})),window.postMessage({type:m.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:this.id},"*")}verifyScriptStartedEvent(t){const r=t.detail?.contentScriptName===this.contentScriptName,a=t.detail?.messageId===this.id;return r&&!a}listenForNewerScripts(){const t=r=>{!(r instanceof CustomEvent)||!this.verifyScriptStartedEvent(r)||this.notifyInvalidated()};document.addEventListener(m.SCRIPT_STARTED_MESSAGE_TYPE,t),this.onInvalidated(()=>document.removeEventListener(m.SCRIPT_STARTED_MESSAGE_TYPE,t))}};function G(){}function g(e,...t){}const _={debug:(...e)=>g(console.debug,...e),log:(...e)=>g(console.log,...e),warn:(...e)=>g(console.warn,...e),error:(...e)=>g(console.error,...e)};return(async()=>{try{const{main:e,...t}=A;return await e(new R("content",t))}catch(e){throw _.error('The content script "content" crashed on startup!',e),e}})()})();
content;