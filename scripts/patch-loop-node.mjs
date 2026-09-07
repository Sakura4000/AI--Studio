import { readFile, writeFile } from "node:fs/promises";

const bundlePath = new URL("../public/app.bundle.js", import.meta.url);
let source = await readFile(bundlePath, "utf8");

function replaceOnce(label, from, to) {
  if (!source.includes(from)) {
    if (source.includes(to)) return;
    throw new Error(`Could not find ${label}`);
  }
  source = source.replace(from, to);
}

function replaceIfPresent(label, from, to) {
  if (source.includes(from)) replaceOnce(label, from, to);
}

function findJsxCallEnd(start) {
  const tokenEnd = source.indexOf("(0,X.jsxs)", start) + "(0,X.jsxs)".length;
  const callStart = source.indexOf("(", tokenEnd);
  if (callStart < 0) return -1;
  let depth = 0;
  for (let index = callStart; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

function removeJsxCall(label, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return;
  const end = findJsxCallEnd(start);
  if (end < 0) throw new Error(`Could not find ${label}`);
  const before = source[start - 1] === "," ? start - 1 : start;
  source = source.slice(0, before) + source.slice(end);
}

function removeConditionalJsx(label, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return;
  const callEnd = findJsxCallEnd(start);
  if (callEnd < 0) throw new Error(`Could not find ${label}`);
  const nullEnd = source.startsWith(":null", callEnd) ? callEnd + 5 : callEnd;
  const before = source[start - 1] === "," ? start - 1 : start;
  source = source.slice(0, before) + source.slice(nullEnd);
}

if (!source.includes('"canvas.loopMaterialUnit"')) {
  replaceOnce(
    "loop translations",
    '"canvas.loopNode":{zh:`循环节点`,en:`Loop Node`},',
    '"canvas.loopNode":{zh:`循环节点`,en:`Loop Node`},"canvas.loopMaterialUnit":{zh:`份素材`,en:`assets`},"canvas.loopMaterialUnitShort":{zh:`份`,en:`assets`},"canvas.loopPerRound":{zh:`每轮`,en:`Per round`},"canvas.loopRoundUnit":{zh:`轮`,en:`rounds`},"canvas.loopExecution":{zh:`执行方式`,en:`Execution`},'
  );
}
if (!source.includes('"canvas.loopPromptDisableAll"')) {
  replaceOnce(
    "prompt translations",
    '"canvas.loopExecution":{zh:`执行方式`,en:`Execution`},',
    '"canvas.loopExecution":{zh:`执行方式`,en:`Execution`},"canvas.loopPromptDisableAll":{zh:`全部禁用`,en:`Disable all`},"canvas.loopPromptEnableAll":{zh:`全部启用`,en:`Enable all`},"canvas.loopPromptShared":{zh:`全部共用`,en:`Shared for all`},"canvas.loopPromptCommon":{zh:`公共提示词`,en:`Shared prompt`},"canvas.loopPromptRound":{zh:`第 {n} 轮提示词`,en:`Prompt for round {n}`},"canvas.loopRoundTab":{zh:`第 {n} 轮`,en:`Round {n}`},"canvas.loopRoundInput":{zh:`第 {n} 轮输入素材`,en:`Round {n} input assets`},"canvas.loopPromptSharedPlaceholder":{zh:`输入所有轮次共用的提示词`,en:`Enter a prompt shared by all rounds`},"canvas.loopPromptRoundPlaceholder":{zh:`输入当前轮次使用的提示词`,en:`Enter the prompt for this round`},',
  );
}
if (!source.includes('"canvas.loopPromptShared"')) {
  replaceOnce(
    "missing loop prompt translations",
    '"canvas.loopPromptEnableAll":{zh:`全部启用`,en:`Enable all`},',
    '"canvas.loopPromptEnableAll":{zh:`全部启用`,en:`Enable all`},"canvas.loopPromptShared":{zh:`全部共用`,en:`Shared for all`},"canvas.loopPromptCommon":{zh:`公共提示词`,en:`Shared prompt`},"canvas.loopRoundTab":{zh:`第 {n} 轮`,en:`Round {n}`} ,"canvas.loopRoundInput":{zh:`第 {n} 轮输入素材`,en:`Round {n} input assets`},"canvas.loopPromptSharedPlaceholder":{zh:`输入所有轮次共用的提示词`,en:`Enter a prompt shared by all rounds`},"canvas.loopPromptRoundPlaceholder":{zh:`输入当前轮次使用的提示词`,en:`Enter the prompt for this round`},',
  );
}
replaceOnce("loop count label", '"canvas.loopCount":{zh:`次数`,en:`Runs`}', '"canvas.loopCount":{zh:`总轮数`,en:`Total rounds`}');
replaceOnce("loop serial label", '"canvas.loopSerial":{zh:`循环`,en:`Batch`}', '"canvas.loopSerial":{zh:`依次执行`,en:`Sequential`}');
replaceOnce("loop parallel label", '"canvas.loopParallel":{zh:`并发`,en:`Concurrent`}', '"canvas.loopParallel":{zh:`同时执行`,en:`Parallel`}');
replaceOnce("loop hint", '"canvas.loopHint":{zh:`控制一键运行轮数`,en:`Controls cascade rounds`}', '"canvas.loopHint":{zh:`按每轮数量自动计算总轮数`,en:`Calculates total rounds from assets per round`}');
replaceOnce("loop image label", '"canvas.loopImageToggle":{zh:`图片`,en:`Images`}', '"canvas.loopImageToggle":{zh:`素材`,en:`Assets`}');
replaceOnce("loop batch label", '"canvas.loopBatchSize":{zh:`批次`,en:`Batch size`}', '"canvas.loopBatchSize":{zh:`每轮`,en:`Per round`}');
replaceOnce("loop image hint", '"canvas.loopImageWillOutput":{zh:`将取出 {n} 张图片`,en:`Will take {n} images`}', '"canvas.loopImageWillOutput":{zh:`每轮处理 {n} 份素材`,en:`Processes {n} assets per round`}');
replaceOnce("loop image empty hint", '"canvas.loopImageEmpty":{zh:`暂未连接图片节点`,en:`No image nodes connected`}', '"canvas.loopImageEmpty":{zh:`等待连接素材`,en:`Connect assets to calculate rounds`}');
replaceOnce("smart loop description", '"smart.createLoopSub":{zh:`控制一键运行轮数和批次`,en:`Control run rounds and batches`}', '"smart.createLoopSub":{zh:`控制一键运行轮数和每轮数量`,en:`Control rounds and assets per round`}');

if (source.includes("function d$(e,t,n){return n.filter(t=>t.to===e.id).map(e=>i$(t,e.from)).filter(e=>!!e)}")) {
  replaceOnce(
    "loop connection field normalization",
    "function d$(e,t,n){return n.filter(t=>t.to===e.id).map(e=>i$(t,e.from)).filter(e=>!!e)}",
    "function d$(e,t,n){return n.filter(t=>String(t.to??t.target??t.targetId)===String(e.id)).map(e=>i$(t,e.from??e.source??e.sourceId)).filter(e=>!!e)}",
  );
}
replaceIfPresent(
  "loop connection endpoint normalization",
  "function d$(e,t,n){return n.filter(t=>String(t.to??t.target??t.targetId)===String(e.id)).map(e=>i$(t,e.from??e.source??e.sourceId)).filter(e=>!!e)}",
  "function d$(e,t,n){return n.flatMap(n=>{let r=n.to?.id??n.to?.nodeId??n.to,i=n.from?.id??n.from?.nodeId??n.from;return String(r)===String(e.id)?[i$(t,i)]:String(i)===String(e.id)?[i$(t,r)]:[]}).filter(e=>!!e)}",
);
replaceIfPresent(
  "loop node id normalization",
  "function i$(e,t){return e.find(e=>e.id===t)||null}",
  "function i$(e,t){return e.find(e=>String(e.id)===String(t))||null}",
);
replaceIfPresent(
  "loop asset kind normalization",
  "function a$(e){return e?.kind||JX(e?.url||``)}",
  "function a$(e){return String(e?.kind||e?.mediaKind||JX(e?.url||``)).toLowerCase()}",
);
replaceIfPresent(
  "loop image preview fallback",
  "if(e.type===`image`&&MX(e,`url`)){let t=YX(e);return[{url:MX(e,`url`),",
  "if(e.type===`image`&&(MX(e,`url`)||MX(e,`preview`))){let t=YX({...e,url:MX(e,`url`)||MX(e,`preview`)});return[{url:MX(e,`url`)||MX(e,`preview`),",
);
replaceIfPresent(
  "loop uppercase image type normalization",
  "if(e.type===`image`&&(MX(e,`url`)||MX(e,`preview`))){let t=YX({...e,url:MX(e,`url`)||MX(e,`preview`)});return[{url:MX(e,`url`)||MX(e,`preview`),",
  "if(String(e.type).toLowerCase()===`image`&&(MX(e,`url`)||MX(e,`preview`))){let t=YX({...e,url:MX(e,`url`)||MX(e,`preview`)});return[{url:MX(e,`url`)||MX(e,`preview`),",
);
replaceIfPresent(
  "loop direct image material fallback",
  "function _$(e,t,n){return o$(d$(e,t,n).flatMap(e=>l$(e,t)))}",
  "function _$(e,t,n){return o$(d$(e,t,n).flatMap(e=>{let r=l$(e,t);return r.length?r:String(e?.type).toLowerCase()===`image`&&String(e?.kind||e?.mediaKind||``).toLowerCase()!==`video`?[{url:MX(e,`url`)||MX(e,`preview`)||``,name:MX(e,`name`)||`image`,kind:`image`,nodeId:e.id}]:[]}))}",
);

replaceOnce(
  "loop canvas connection prop",
  "function wbe({interaction:e,nodes:t,editingNodeId:n,className:r,connectionsLayerRef:i,",
  "function wbe({interaction:e,nodes:t,editingNodeId:n,className:r,connections:providedConnections,connectionsLayerRef:i,",
);
replaceOnce(
  "loop live connection source",
  "ue=providedConnections||DZ(e=>e.canvas?.connections||Cbe)",
  "ue=DZ(e=>e.connections?.length?e.connections:e.canvas?.connections||providedConnections||Cbe)",
);
const mergedLoopGraph = "d=DZ(e=>e.setConnections),liveNodes=DZ(e=>e.nodes),liveConnections=DZ(e=>e.connections),canvasNodes=DZ(e=>e.canvas?.nodes||[]),canvasConnections=DZ(e=>e.canvas?.connections||[]),graphNodes=Array.from(new Map([...t||[],...canvasNodes,...liveNodes].filter(e=>e?.id!=null).map(e=>[String(e.id),e])).values()),graphConnections=Array.from(new Map([...n||[],...canvasConnections,...liveConnections].filter(e=>!!e).map((e,t)=>[String(e.id||`${e.from?.id??e.from}-${e.to?.id??e.to}-${t}`),e])).values())";
replaceIfPresent(
  "loop graph state merge",
  "d=DZ(e=>e.setConnections),liveNodes=DZ(e=>e.nodes),liveConnections=DZ(e=>e.connections),graphNodes=liveNodes.some(t=>t.id===e.id)?liveNodes:t,graphConnections=liveConnections.length?liveConnections:n",
  mergedLoopGraph,
);
replaceIfPresent(
  "loop direct graph subscriptions",
  "d=DZ(e=>e.setConnections),graphNodes=t,graphConnections=n",
  mergedLoopGraph,
);

replaceOnce(
  "loop node defaults",
  "function qhe(e){return{id:IX(`loop`),type:`loop`,x:e.x,y:e.y,count:1,mode:`serial`,showPrompt:!0,imageInput:!0,videoInput:!1,loopStart:1,imageBatchSize:1,videoBatchSize:1,variablePrompt:``,fixedPrompt:``}}",
  "function qhe(e){return{id:IX(`loop`),type:`loop`,x:e.x,y:e.y,count:0,mode:`serial`,showPrompt:!0,imageInput:!0,videoInput:!1,promptShared:!1,roundPrompts:[],loopStart:1,imageBatchSize:1,videoBatchSize:1,variablePrompt:``,fixedPrompt:``}}",
);

replaceOnce(
  "loop toolbar entry",
  "var VTe=[{kind:`image`,labelKey:`canvas.nodeUpload`,icon:Jp},{kind:`prompt`,labelKey:`canvas.nodePrompt`,icon:rm,separatorAfter:!0},{kind:`loop`,labelKey:`canvas.loop`,icon:vp},{kind:`generator`,labelKey:`canvas.apiGenerate`,icon:bm}",
  "var VTe=[{kind:`image`,labelKey:`canvas.nodeUpload`,icon:Jp},{kind:`prompt`,labelKey:`canvas.nodePrompt`,icon:rm,separatorAfter:!0},{kind:`loop`,labelKey:`canvas.loop`,icon:hm},{kind:`generator`,labelKey:`canvas.apiGenerate`,icon:bm}",
);

if (source.includes("C=v$(e,t,n,m).length,w={nodes:t,connections:n}")) {
  replaceOnce(
    "loop round calculation",
    "C=v$(e,t,n,m).length,w={nodes:t,connections:n}",
    "C=v$(e,t,n,m).length,R=S>0?Math.max(1,Math.ceil(S/h)):f,w={nodes:t,connections:n}",
  );
}

const oldLoopState = "l=(0,v.useRef)(null),u=(0,v.useRef)(null),d=DZ(e=>e.setConnections),f=Math.max(1,NX(e,`count`,3)),p=MX(e,`mode`)===`parallel`?`parallel`:`serial`,m=Math.max(1,NX(e,`loopStart`,1)),h=Math.max(1,Math.min(100,NX(e,`imageBatchSize`,1))),g=PX(e,`imageInput`),_=PX(e,`showPrompt`),y=MX(e,`variablePrompt`),b=g$(e,t,n),x=b.length>0,S=_$(e,t,n).length,C=v$(e,t,n,m).length,R=S>0?Math.max(1,Math.ceil(S/h)):f,w={nodes:t,connections:n},T=$_e(e.id,w),E=T&&t.find(e=>e.id===T)||null";
const newLoopState = "l=(0,v.useRef)(null),u=(0,v.useRef)(null),activeRoundState=(0,v.useState)(1),d=DZ(e=>e.setConnections),graphNodes=t,graphConnections=n,f=Math.max(1,NX(e,`count`,3)),p=MX(e,`mode`)===`parallel`?`parallel`:`serial`,m=Math.max(1,NX(e,`loopStart`,1)),h=Math.max(1,Math.min(100,NX(e,`imageBatchSize`,1))),g=!0,_=PX(e,`showPrompt`,!0),y=MX(e,`variablePrompt`),promptShared=PX(e,`promptShared`,!1),roundPrompts=FX(e,`roundPrompts`),b=g$(e,graphNodes,graphConnections),x=b.length>0,S=g?_$(e,graphNodes,graphConnections).length:0,C=g?v$(e,graphNodes,graphConnections,m).length:0,availableMaterials=Math.max(0,S-m+1),R=availableMaterials>0?Math.ceil(availableMaterials/h):0,activeRound=Math.max(1,Math.min(Math.max(1,R),activeRoundState[0])),promptText=promptShared?y:String(roundPrompts[activeRound-1]||y||``),roundInputs=Array.from({length:R},(e,t)=>v$(e,graphNodes,graphConnections,m+t*h)),activeInputs=roundInputs[activeRound-1]||[],w={nodes:graphNodes,connections:graphConnections},T=$_e(e.id,w),E=T&&graphNodes.find(e=>e.id===T)||null";
if (source.includes(oldLoopState)) replaceOnce("live loop graph state", oldLoopState, newLoopState);
const oldLiveLoopGraph = "d=DZ(e=>e.setConnections),liveNodes=DZ(e=>e.nodes),liveConnections=DZ(e=>e.connections),usesLiveGraph=liveNodes.some(t=>t.id===e.id),graphNodes=usesLiveGraph?liveNodes:t,graphConnections=usesLiveGraph?liveConnections:n";
const currentLoopGraph = "d=DZ(e=>e.setConnections),graphNodes=t,graphConnections=n";
const directLoopGraph = "d=DZ(e=>e.setConnections),liveNodes=DZ(e=>e.nodes),liveConnections=DZ(e=>e.connections),graphNodes=liveNodes.some(t=>t.id===e.id)?liveNodes:t,graphConnections=liveConnections.length?liveConnections:n";
if (source.includes(oldLiveLoopGraph)) source = source.replace(oldLiveLoopGraph, currentLoopGraph);
if (source.includes(currentLoopGraph)) source = source.replace(currentLoopGraph, mergedLoopGraph);
if (source.includes(directLoopGraph)) source = source.replace(directLoopGraph, mergedLoopGraph);

replaceIfPresent(
  "loop round input callback node scope",
  "roundInputs=Array.from({length:R},(e,t)=>v$(e,graphNodes,graphConnections,m+t*h))",
  "roundInputs=Array.from({length:R},(n,t)=>v$(e,graphNodes,graphConnections,m+t*h))",
);

replaceIfPresent(
  "loop node default rounds zero",
  "type:`loop`,x:e.x,y:e.y,count:1,mode:`serial`",
  "type:`loop`,x:e.x,y:e.y,count:0,mode:`serial`",
);
replaceIfPresent(
  "loop node ignores old start offset",
  "m=Math.max(1,NX(e,`loopStart`,1))",
  "m=1",
);
replaceIfPresent(
  "loop node allows zero rounds",
  "f=Math.max(1,NX(e,`count`,3))",
  "f=Math.max(0,NX(e,`count`,0))",
);
replaceIfPresent(
  "loop material total ignores old start offset",
  "availableMaterials=Math.max(0,S-m+1)",
  "availableMaterials=S",
);
replaceIfPresent(
  "loop slice ignores old start offset",
  "o=Math.max(0,Number(r||NX(e,`loopStart`,1))-1)",
  "o=Math.max(0,Number(r||1)-1)",
);
replaceIfPresent(
  "loop runtime ignores old start offset",
  "a=Math.max(1,Number(i?.loopStart)||1)",
  "a=1",
);
replaceIfPresent(
  "loop run index ignores old start offset",
  "c=Math.max(1,Number(o?.node?.loopStart)||1)",
  "c=1",
);
const oldRoundSync = "},[x,i,_,y]);(0,v.useEffect)(()=>{if(g&&S>0){let e=Math.max(1,Math.ceil(S/h));f!==e&&r({count:e})}},[g,S,h,f,r]);let k=n=>{";
const newRoundSync = "},[x,i,_,y]);(0,v.useEffect)(()=>{if(g){let e=S>0?Math.ceil(S/h):0;f!==e&&r({count:e})}},[g,S,h,f,r]);(0,v.useEffect)(()=>{let e=Math.max(1,R);activeRoundState[0]>e&&activeRoundState[1](e)},[R]);let k=n=>{";
if (!source.includes(newRoundSync) && source.includes(oldRoundSync)) replaceOnce("loop round synchronization", oldRoundSync, newRoundSync);
replaceIfPresent(
  "loop zero-round synchronization",
  "},[x,i,_,y]);(0,v.useEffect)(()=>{if(g&&S>0){let e=Math.max(1,Math.ceil(Math.max(0,S-m+1)/h));f!==e&&r({count:e})}},[g,S,h,f,r,m]);",
  "},[x,i,_,y]);(0,v.useEffect)(()=>{if(g){let e=S>0?Math.ceil(S/h):0;f!==e&&r({count:e})}},[g,S,h,f]);",
);
replaceIfPresent(
  "loop zero-round synchronization after prompt state",
  "},[x,i,_,promptText]);(0,v.useEffect)(()=>{if(g&&S>0){let e=Math.max(1,Math.ceil(Math.max(0,S-m+1)/h));f!==e&&r({count:e})}},[g,S,h,f,r,m]);",
  "},[x,i,_,promptText]);(0,v.useEffect)(()=>{if(g){let e=S>0?Math.ceil(S/h):0;f!==e&&r({count:e})}},[g,S,h,f]);",
);
replaceOnce(
  "loop prompt text state",
  "r$(e)!==y)&&(e.innerHTML=pve(y),i&&!x)",
  "r$(e)!==promptText)&&(e.innerHTML=pve(promptText),i&&!x)",
);
replaceOnce("loop prompt text dependencies", "},[x,i,_,y]);(0,v.useEffect)", "},[x,i,_,promptText]);(0,v.useEffect)");
replaceOnce(
  "loop prompt editor update",
  "j=()=>{r({variablePrompt:r$(l.current)})}",
  "j=()=>{let e=r$(l.current);if(promptShared){r({variablePrompt:e});return}let t=[...roundPrompts];t[activeRound-1]=e,r({roundPrompts:t})}",
);
replaceOnce("loop graph cleanup", "let r=t.map(t=>t.id===e.id?n:t)", "let r=graphNodes.map(t=>t.id===e.id?n:t)");

const oldFirstRow = "(0,X.jsxs)(`div`,{className:`loop-run-row`,children:[(0,X.jsxs)(`div`,{className:`loop-count-group`,children:[(0,X.jsx)(`span`,{className:`loop-count-label`,children:c(`canvas.loopCount`)}),(0,X.jsx)(e$,{ariaLabel:c(`canvas.loopCount`),className:`loop-count-stepper`,decreaseLabel:c(`canvas.decrease`),increaseLabel:c(`canvas.increase`),max:100,min:1,onChange:e=>r({count:e}),value:f})]}),(0,X.jsxs)(`div`,{className:`seg loop-mode`,children:[(0,X.jsx)(`button`,{className:p===`serial`?`active`:``,onClick:()=>r({mode:`serial`}),type:`button`,children:c(`canvas.loopSerial`)}),(0,X.jsx)(`button`,{className:p===`parallel`?`active`:``,onClick:()=>r({mode:`parallel`}),type:`button`,children:c(`canvas.loopParallel`)})]})]})";
const newFirstRow = [
  "(0,X.jsxs)(`div`,{className:`loop-summary-row`,children:[",
  "(0,X.jsxs)(`div`,{className:`loop-summary-item loop-summary-source`,children:[(0,X.jsx)(`strong`,{children:S}),(0,X.jsx)(`span`,{children:c(`canvas.loopMaterialUnit`)})]}),",
  "(0,X.jsx)(`span`,{className:`loop-summary-separator`,children:`·`}),",
  "(0,X.jsx)(`span`,{className:`loop-summary-label`,children:c(`canvas.loopPerRound`)}),",
  "(0,X.jsx)(e$,{ariaLabel:c(`canvas.loopPerRound`),className:`loop-count-stepper loop-batch-stepper`,decreaseLabel:c(`canvas.decrease`),increaseLabel:c(`canvas.increase`),max:100,min:1,onChange:e=>{let t=e;r({imageBatchSize:t,count:S>0?Math.ceil(S/t):0})},value:h}),",
  "(0,X.jsx)(`span`,{className:`loop-summary-unit`,children:c(`canvas.loopMaterialUnitShort`)}),",
  "(0,X.jsx)(`span`,{className:`loop-summary-equals`,children:`=`}),",
  "(0,X.jsxs)(`div`,{className:`loop-summary-item loop-summary-rounds`,children:[(0,X.jsx)(`strong`,{children:R}),(0,X.jsx)(`span`,{children:c(`canvas.loopRoundUnit`)})]})]}),",
  "(0,X.jsxs)(`div`,{className:`loop-run-row loop-execution-row`,children:[",
  "(0,X.jsx)(`span`,{className:`loop-section-label`,children:c(`canvas.loopExecution`)}),",
  "(0,X.jsxs)(`div`,{className:`seg loop-mode`,children:[(0,X.jsx)(`button`,{className:p===`serial`?`active`:``,onClick:()=>r({mode:`serial`}),type:`button`,children:c(`canvas.loopSerial`)}),(0,X.jsx)(`button`,{className:p===`parallel`?`active`:``,onClick:()=>r({mode:`parallel`}),type:`button`,children:c(`canvas.loopParallel`)})]})]})",
].join("");
const legacyFirstRow = newFirstRow.replace(
  "count:S>0?Math.ceil(S/t):0",
  "count:S>0?Math.ceil(Math.max(0,S-m+1)/t):f",
);
if (source.includes("count:S>0?Math.max(1,Math.ceil(S/t)):f")) {
  replaceOnce(
    "loop per-round count formula",
    "count:S>0?Math.max(1,Math.ceil(S/t)):f",
    "count:S>0?Math.ceil(Math.max(0,S-m+1)/t):f",
  );
}
if (source.includes(oldFirstRow)) source = source.replace(oldFirstRow, newFirstRow);
else if (source.includes(legacyFirstRow)) source = source.replace(legacyFirstRow, newFirstRow);

const oldToggleRow = "(0,X.jsxs)(`div`,{className:`loop-run-row loop-toggle-row`,children:[(0,X.jsxs)(`button`,{className:g?`loop-toggle active loop-material-toggle`:`loop-toggle loop-material-toggle`,onClick:()=>{let e=!g;A({imageInput:e,loopStart:Math.max(1,m),imageBatchSize:Math.max(1,Math.min(100,h))},e,!e)},type:`button`,children:[(0,X.jsx)(Jp,{className:`size-3.5`}),c(`canvas.loopImageToggle`)]}),(0,X.jsx)(`span`,{className:`loop-section-label loop-prompt-title`,children:c(`canvas.loopPromptToggle`)}),(0,X.jsxs)(`button`,{className:promptShared?`loop-toggle active loop-prompt-toggle`:`loop-toggle loop-prompt-toggle`,onClick:()=>{let e=!promptShared;e?r({promptShared:!0,variablePrompt:roundPrompts[activeRound-1]||y,showPrompt:!0}):r({promptShared:!1,roundPrompts:roundPrompts.length?roundPrompts:Array.from({length:Math.max(1,R)},()=>y),showPrompt:!0})},type:`button`,children:[(0,X.jsx)(km,{className:`size-3.5`}),(0,X.jsx)(`span`,{children:promptShared?c(`canvas.loopPromptShared`):c(`canvas.loopPromptDisableAll`)})]})]})";
const newToggleRow = [
  "(0,X.jsxs)(`div`,{className:`loop-run-row loop-toggle-row`,children:[",
  "(0,X.jsx)(`span`,{className:`loop-section-label loop-prompt-title`,children:c(`canvas.loopPromptToggle`)}),",
  "(0,X.jsxs)(`button`,{className:promptShared?`loop-toggle active loop-prompt-toggle`:`loop-toggle loop-prompt-toggle`,onClick:()=>{let e=!promptShared;e?r({promptShared:!0,variablePrompt:roundPrompts[activeRound-1]||y,showPrompt:!0}):r({promptShared:!1,roundPrompts:roundPrompts.length?roundPrompts:Array.from({length:Math.max(1,R)},()=>y),showPrompt:!0})},type:`button`,children:[(0,X.jsx)(km,{className:`size-3.5`}),(0,X.jsx)(`span`,{children:promptShared?c(`canvas.loopPromptShared`):c(`canvas.loopPromptDisableAll`)})]})]})",
].join("");
const sharedToggleLabel = "children:promptShared?c(`canvas.loopPromptShared`):c(`canvas.loopPromptDisableAll`)";
const sharedToggleLabelStatic = "children:c(`canvas.loopPromptShared`)";
const newToggleRowStatic = newToggleRow.replace(sharedToggleLabel, sharedToggleLabelStatic);
if (!source.includes(newToggleRow) && !source.includes(newToggleRowStatic)) {
  replaceOnce("loop prompt header", oldToggleRow, newToggleRow);
}
if (source.includes(sharedToggleLabel)) {
  replaceOnce("loop shared toggle label", sharedToggleLabel, sharedToggleLabelStatic);
}
replaceIfPresent(
  "loop prompt round label",
  "children:[(0,X.jsx)(`div`,{className:`loop-prompt-round-label`,children:n0(c(`canvas.loopPromptRound`),{n:m})}),(0,X.jsx)(`div`,{className:Z(`loop-variable-editor`",
  "children:[(0,X.jsx)(`div`,{className:`loop-prompt-round-label`,children:promptShared?c(`canvas.loopPromptCommon`):n0(c(`canvas.loopPromptRound`),{n:activeRound})}),!promptShared&&R>0?(0,X.jsx)(`div`,{className:`loop-round-tabs`,children:roundInputs.map((e,t)=>(0,X.jsxs)(`button`,{className:activeRound===t+1?`loop-round-tab active`:`loop-round-tab`,onClick:e=>{e.stopPropagation(),activeRoundState[1](t+1)},type:`button`,children:[e[0]?.url?(0,X.jsx)(`img`,{alt:e[0].name||c(`canvas.loopImageToggle`),draggable:!1,src:e[0].url}):null,(0,X.jsx)(`span`,{children:n0(c(`canvas.loopRoundTab`),{n:t+1})})]},t))}):null,!promptShared&&activeInputs.length?(0,X.jsx)(`div`,{className:`loop-active-inputs`,children:[(0,X.jsx)(`span`,{className:`loop-active-input-label`,children:n0(c(`canvas.loopRoundInput`),{n:activeRound})}),activeInputs.map((e,t)=>(0,X.jsxs)(`div`,{className:`loop-active-input`,children:[(0,X.jsx)(`img`,{alt:e.name||c(`canvas.loopImageToggle`),draggable:!1,src:e.url}),(0,X.jsx)(`span`,{children:e.name||e.kind||c(`canvas.loopImageToggle`)})]},`${activeRound}-${t}-${e.url}`))]}):null,(0,X.jsx)(`div`,{className:Z(`loop-variable-editor`",
);
replaceIfPresent(
  "loop round input thumbnail layout",
  "!promptShared&&activeInputs.length?(0,X.jsx)(`div`,{className:`loop-active-inputs`,children:[(0,X.jsx)(`span`,{className:`loop-active-input-label`,children:n0(c(`canvas.loopRoundInput`),{n:activeRound})}),activeInputs.map((e,t)=>(0,X.jsxs)(`div`,{className:`loop-active-input`,children:[(0,X.jsx)(`img`,{alt:e.name||c(`canvas.loopImageToggle`),draggable:!1,src:e.url}),(0,X.jsx)(`span`,{children:e.name||e.kind||c(`canvas.loopImageToggle`)})]},`${activeRound}-${t}-${e.url}`))]}):null",
  "!promptShared&&activeInputs.length?(0,X.jsxs)(`div`,{className:`loop-active-inputs`,children:[(0,X.jsx)(`div`,{className:`loop-active-input-label`,children:n0(c(`canvas.loopRoundInput`),{n:activeRound})}),(0,X.jsx)(`div`,{className:`loop-active-input-list`,children:activeInputs.map((e,t)=>(0,X.jsx)(`div`,{className:`loop-active-input`,title:e.name||e.kind||c(`canvas.loopImageToggle`),children:(0,X.jsx)(`img`,{alt:e.name||c(`canvas.loopImageToggle`),draggable:!1,src:qX(e.url,160)})},`${activeRound}-${t}-${e.url}`))})]}):null",
);
replaceOnce(
  "loop prompt placeholder",
  "\"data-placeholder\":c(`canvas.loopVariablePlaceholder`)",
  "\"data-placeholder\":c(promptShared?`canvas.loopPromptSharedPlaceholder`:`canvas.loopPromptRoundPlaceholder`)",
);
if (source.includes("g=PX(e,`imageInput`),_=PX(e,`showPrompt`,!0)")) {
  replaceOnce(
    "loop image input default",
    "g=PX(e,`imageInput`),_=PX(e,`showPrompt`,!0)",
    "g=PX(e,`imageInput`,!0),_=PX(e,`showPrompt`,!0)",
  );
}
if (source.includes("g=PX(e,`imageInput`,!0),_=PX(e,`showPrompt`,!0)")) {
  replaceOnce(
    "loop image input always enabled",
    "g=PX(e,`imageInput`,!0),_=PX(e,`showPrompt`,!0)",
    "g=!0,_=PX(e,`showPrompt`,!0)",
  );
}
if (
  source.includes("g?(0,X.jsxs)(`div`,{className:`loop-image-panel`") ||
  source.includes("g&&S===0?(0,X.jsxs)(`div`,{className:`loop-image-panel`")
) {
  replaceOnce(
    "hide connected loop material setup",
    "g?(0,X.jsxs)(`div`,{className:`loop-image-panel`",
    "g&&S===0?(0,X.jsxs)(`div`,{className:`loop-image-panel`",
  );
}
removeConditionalJsx(
  "loop material panel",
  "g&&S===0?(0,X.jsxs)(`div`,{className:`loop-image-panel`",
);
removeJsxCall(
  "loop prompt start row",
  "(0,X.jsxs)(`div`,{className:`loop-start-row`",
);
replaceOnce(
  "loop runtime prompt selection",
  "let a=MX(e,`variablePrompt`)||MX(e,`fixedPrompt`),{index:o,total:s}=hve(e,r),c=e=>String(e||``).replace(/\\{\\{\\s*计数\\s*\\}\\}/g,String(o)).replace(/\\{\\{\\s*总数\\s*\\}\\}/g,String(s)).replace(/\\{\\{\\s*进度\\s*\\}\\}/g,`${o}/${s}`),l=g$(e,t,n,i);return c((l.length?l[(o-1)%l.length]:``)||a)",
  "let a=MX(e,`variablePrompt`)||MX(e,`fixedPrompt`),{index:o,total:s}=hve(e,r),c=e=>String(e||``).replace(/\\{\\{\\s*计数\\s*\\}\\}/g,String(o)).replace(/\\{\\{\\s*总数\\s*\\}\\}/g,String(s)).replace(/\\{\\{\\s*进度\\s*\\}\\}/g,`${o}/${s}`),l=g$(e,t,n,i),u=PX(e,`promptShared`,!1),d=FX(e,`roundPrompts`),f=u?(l.length?l[(o-1)%l.length]:``):String(d[Math.max(0,o-1)]||``);return c(f||a)",
);
replaceOnce(
  "loop cascade graph props",
  "(0,X.jsx)(WQ,{active:D,connections:n,disabled:D?O:!o,node:E,nodes:t,onClick:o,onStop:s,stopping:O})",
  "(0,X.jsx)(WQ,{active:D,connections:graphConnections,disabled:D?O:!o,node:E,nodes:graphNodes,onClick:o,onStop:s,stopping:O})",
);
if (source.includes("function UQ(e,t){let n=eve(e,t.connections),r=t.nodes.filter(e=>RQ(e)===`loop`&&n.has(e.id));if(!r.length)return null;let i=r[r.length-1];return i?{node:i,count:Q_e(i),mode:i.mode===`parallel`?`parallel`:`serial`}:null}")) {
  replaceOnce(
    "loop runtime round count",
    "function UQ(e,t){let n=eve(e,t.connections),r=t.nodes.filter(e=>RQ(e)===`loop`&&n.has(e.id));if(!r.length)return null;let i=r[r.length-1];return i?{node:i,count:Q_e(i),mode:i.mode===`parallel`?`parallel`:`serial`}:null}",
    "function UQ(e,t){let n=eve(e,t.connections),r=t.nodes.filter(e=>RQ(e)===`loop`&&n.has(e.id));if(!r.length)return null;let i=r[r.length-1],a=Math.max(1,Number(i?.loopStart)||1),o=Math.max(1,Math.min(100,Number(i?.imageBatchSize)||1)),s=PX(i,`imageInput`)?Math.max(0,Math.ceil(Math.max(0,_$(i,t.nodes,t.connections).length-a+1)/o)):Q_e(i);return i?{node:i,count:s,mode:i.mode===`parallel`?`parallel`:`serial`}:null}",
  );
}
replaceIfPresent(
  "loop runtime zero rounds",
  "o=UQ(e,n),s=o?.count||1,c=Math.max(1,Number(o?.node?.loopStart)||1)",
  "o=UQ(e,n),s=o?Math.max(0,Number(o.count)||0):1,c=Math.max(1,Number(o?.node?.loopStart)||1)",
);
if (source.includes("function v$(e,t,n,r){if(!PX(e,`imageInput`))return[];")) {
  replaceOnce(
    "loop asset helper default",
    "function v$(e,t,n,r){if(!PX(e,`imageInput`))return[];",
    "function v$(e,t,n,r){if(!PX(e,`imageInput`,!0))return[];",
  );
}
replaceOnce(
  "loop asset input always enabled",
  "function v$(e,t,n,r){if(!PX(e,`imageInput`,!0))return[];",
  "function v$(e,t,n,r){",
);
if (source.includes("+!!PX(e,`imageInput`)") && !source.includes("+!!PX(e,`imageInput`,!0)")) {
  replaceOnce(
    "loop node size asset default",
    "+!!PX(e,`imageInput`)",
    "+!!PX(e,`imageInput`,!0)",
  );
}
replaceOnce(
  "loop node size always includes assets",
  "+!!PX(e,`showPrompt`)+ +!!PX(e,`imageInput`,!0)",
  "+!!PX(e,`showPrompt`)+1",
);
if (source.includes("s=PX(i,`imageInput`)?Math.max(0,Math.ceil(Math.max(0,_$(i,t.nodes,t.connections).length-a+1)/o)):Q_e(i)")) {
  replaceOnce(
    "loop runtime asset default",
    "s=PX(i,`imageInput`)?Math.max(0,Math.ceil(Math.max(0,_$(i,t.nodes,t.connections).length-a+1)/o)):Q_e(i)",
    "s=PX(i,`imageInput`,!0)?Math.max(0,Math.ceil(Math.max(0,_$(i,t.nodes,t.connections).length-a+1)/o)):Q_e(i)",
  );
}
replaceOnce(
  "loop runtime always uses assets",
  "s=PX(i,`imageInput`,!0)?Math.max(0,Math.ceil(Math.max(0,_$(i,t.nodes,t.connections).length-a+1)/o)):Q_e(i)",
  "s=Math.max(0,Math.ceil(Math.max(0,_$(i,t.nodes,t.connections).length-a+1)/o))",
);
replaceOnce(
  "loop connection always accepts assets",
  "if(a.type===`loop`){let e=!!a.imageInput&&[`image`,`group`,`output`].includes(r1(i)),t=!!a.showPrompt&&[`prompt`,`promptGroup`,`group`,`loop`].includes(r1(i));return e||t}",
  "if(a.type===`loop`){let e=[`image`,`group`,`output`].includes(r1(i)),t=!!a.showPrompt&&[`prompt`,`promptGroup`,`group`,`loop`].includes(r1(i));return e||t}",
);

await writeFile(bundlePath, source, "utf8");
console.log("Patched loop node source");
