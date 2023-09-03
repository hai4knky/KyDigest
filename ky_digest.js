/*
KYR License.

こよりの推し活にのみMIT Licenseが適用されます。
それ以外には使用禁止です。
*/

let kyg_version = "0.1.3";

let kyg_player;
let kyg_scenario = kyg_scenarioRecommended;


let kyg_do = true;
let kyg_parentElt;
let kyg_curPos = 0;


let kyg_totTime = 0;
let kyg_lastSeekTime = 0;
let kyg_seekJobs = [];
let kyg_playStarted = false;


let kyg_seekbarState = {elt:"konkoyo", cursor:"konkoyo", pos:0};
let kyg_timestampState = {parent: "konkoyo", idx: -1, lang:"", elements:[], titleElt: "konkoyo"};
let kyg_timeInfo;



// subtitles dont work in full screen mode. gave up to implement this.
let kyg_subtitlesState = {elt: "konkoyo", items: []};// item.elt, item.info, item.idx(idx is that in kyg_subtitles(declared in html))

let kyg_appStrTemplate = `
<div name="kyPlayerContainer" id="kyPlayerContainer" style="width:95%;">
	<div id="kyPlayer"></div>
	<div id="kySubtitles"></div>
</div>
<div id="kySeekbar" style="display:block;margin-top:10px;width: 95%; height:12px; background-color:#e57462;">
	<div id="kySeekbarCursor" style="width:2px; height:12px;background-color: #272112;margin-left:0%;"></div>
	<div id="kySeekbarSeperator" style="position:relative;"></div>
</div>
<div style="margin-top: 10px;">
    <span id="kyTimeInfo" style="margin-bottom: 10px;"></span>
    <span id="kyCurTitle" style="margin-left: 10px;"></span>
</div>
<button id="kyNextButton">>Next Chapter</button>
<div id="kyScenarioCreator" style="border: 1px solid #012;">
    <div id="kyScenarioTypeSelector">
        <div>
            <input type="radio" id="kyRadio0" name="kyScenarioType" value="recommended" checked></input>
            <span>Recommended</span>
        </div>
        <div style="margin-top:1rem;">
            <input type="radio" id="kyRadio1" name="kyScenarioType" value="custom"></input>
            <span>Custom</span>
        </div>
    </div>
    <div id="kyScenarioTags"></div>
</div>
<div id="kyTimestamps" style="border: 1px solid #012;margin-top: 1rem;margin-bottom: 1rem;height: 30em; overflow-y: scroll;">
</div>
<div>
<b># 使い方</b><br/>
動画を再生してください。<br/>
指定された部分をダイジェストのように視聴できます。<br/>
<br/>
</div>
<div id="kyAboutDetailBtn">[クリックで詳細表示]</div>
<div id="kyAboutDetail" hidden>
具体的には以下のような動作をします。<br/>
・指定された区間以外を再生していると、次の指定された区間を探します。<br/>
・それが見つかればそこに進みます。見つからなければ一時停止状態になります。<br/>
この処理は、javascriptで書かれたky_digest.js内のkyPlayerUpdate()が行っています。<br/>
<br/>
再生開始後は、シークバーをクリックするとジャンプすることができます。<br/>
同じく再生開始後は、タイムスタンプをクリックしてもジャンプできます。<br/>
YouTubeのUIを使っても操作できますが、上述の規則にしたがって動作します。<br/>
<br/>
(再生する区間の指定には、オススメ(recommended)とカスタム(custom)とがあります。<br/>
カスタムに該当するデータが用意されていない場合、オススメ・カスタムを選択するためのUIは現れません。<br/>
カスタムは、タグごとにいくつかの区間が設定されており、チェックを入れたタグに属する区間を視聴することができます。)<br/>

</div>

`;

if(typeof kyg_scenarioElements == "undefined"){
    kyg_scenarioElements = {
        
    };
    
}

function _getSpeedFlag(){
    if(typeof kyg_speedFlag=='undefined'){
        return false;
    }
    
    return kyg_speedFlag;
}
function _getSpeedRate(scenarioIdx){
    if(typeof kyg_speedRates == 'undefined'){
        console.log("speedrate__");
        return 1.0;
    }
    let val = kyg_speedRates[scenarioIdx];
    
    console.log("speedrate__, oh");
    return val;
}

function kySpeedChangerInit(){
    if(!_getSpeedFlag()){
        kyg_speedRates = [];
        for(let i=0; i<kyg_scenario.length; i++){
            kyg_speedRates.push(1.0);
        }
    }
}

function kySpeedChangerUpdate(){
    if(!_getSpeedFlag()){
        return;
    }
    
    let spd = _getSpeedRate(_getChapter(kyg_curPos));
    
    if(spd != kyg_player.getPlaybackRate()){
        kyg_player.setPlaybackRate(spd);
    }
}

function kyAppCreateFromTemplate(elt){
    elt.innerHTML = kyg_appStrTemplate;
}

function kyConcatScenarios(scenarios){
    let ret = [];
    for(let i=0; i<scenarios.length; i++){
        ret = ret.concat(scenarios[i]);
    }
    
    ret.sort(function (a, b){return a[0] - b[0];})
    return ret;
}

function _setScenarioFromTags(){
    let tags = [];
    let elts = document.getElementsByClassName("kyScenarioTagCheck");
    for(let i=0; i<elts.length; i++){
        if(elts[i].checked){
            tags.push(elts[i].name);
        }
    }
    
    let newScenario = kyCreateScenarioFromTags(tags, kyg_scenarioElements);
    if(newScenario.length > 0){
        kyScenarioChange(newScenario);
    }
    //console.log(newScenario);
    
    
}

function kyScenarioCreatorInit(){
    let tagsElt = document.getElementById("kyScenarioTags");
    if(tagsElt == null){
        return;
    }
    while(tagsElt.childCount > 0){
        tagsElt.removeChild(tagsElt.childElements[0]);
    }
    
    
    
    let recommendedBtn = document.getElementById("kyRadio0");
    recommendedBtn.addEventListener("change", function(e){
        if(recommendedBtn.checked){
            let elts = document.getElementsByClassName("kyScenarioTagCheck");
            for(let i=0; i<elts.length; i++){
                elts[i].disabled = true;
            }
            kyScenarioChange(kyg_scenarioRecommended);
        }
    });
    let customBtn = document.getElementById("kyRadio1");
    customBtn.addEventListener("change", function(e){
        if(customBtn.checked){
            let elts = document.getElementsByClassName("kyScenarioTagCheck");
            for(let i=0; i<elts.length; i++){
                elts[i].disabled = false;
            }
            _setScenarioFromTags();
            
        }
    });
    
    
    let cnt = 0;
    //let tags = [];
    for(let i in kyg_scenarioElements){
        let A = document.createElement("span");
        let elt = document.createElement("input");
        let B= document.createElement("label");
        
        elt.type = "checkbox";
        elt.className = "kyScenarioTagCheck";
        elt.name = i;
        elt.disabled = true;
        
        B.innerText = i;
        A.appendChild(elt);
        A.appendChild(B);
        A.style.marginRight = "10px";
        tagsElt.appendChild(A);
        
        elt.addEventListener("change", function (e){
            if(elt.checked){
            }
            _setScenarioFromTags();
        });
        
        cnt++;
    }
}

function kyCreateScenarioFromTags(tags, scenarioElements){
    let ret = [];
    for(let i=0; i<tags.length; i++){
        if(tags[i] in scenarioElements){
            //console.log(tags[i]);
            let arr = scenarioElements[tags[i]];
            ret = ret.concat(arr);
        }
    }
    
    ret.sort(function (a, b){return a[0] - b[0]});
    return ret;
}

function _getLanguage(){
    let languages = window.navigator.languages;
    
    for(let i=0; i<languages.length; i++){
        let lang = languages[i];
        if(lang == "ja" || lang == "ja-JP"){
            return "jp"
        }
        else if(lang == "en" || lang == "en-US"){
            return "en"
        }
    }
    
    return "jp";
}

function _toTimeStr(t){
    t = Math.floor(t);
    let sec = t % 60;
    let min = Math.floor(t / 60) % 60;
    let hour = Math.floor(t / 3600);
    
    return ('00' + hour).slice(-2) + ":" + ('00' + min).slice(-2) + ":" + ('00' + sec).slice(-2);
}

function kySubtitlesInit(){
    kyg_subtitlesState.elt = document.getElementById("kySubtitles");
    
    window.addEventListener("resize", function(e){
        for(let i=0; i<kyg_subtitlesState.items.length; i++){
            let item = kyg_subtitlesState.items[i];
            _setSubtitlePosAndSize(item.elt, item.info);
        }
    });
}

function _setSubtitlePosAndSize(elt, info){
    let rect = kyg_subtitlesState.elt.parentElement.getBoundingClientRect();
    
    elt.style.fontSize = Math.floor(rect.height * info.fontSize * 0.01) + "px";
    elt.style.left = Math.floor(rect.width  * info.pos[0] * 0.01) + "px";
    elt.style.top  = Math.floor(rect.height * info.pos[1] * 0.01) + "px";
    
}

function kySubtitlesUpdate(){
    for(let i=0; i<kyg_subtitles.length; i++){
        let found = false;
        for(let j=0; j<kyg_subtitlesState.items.length; j++){
            if(kyg_subtitlesState.items[j].idx == i){
                found = true;
                break;
            }
        }
        
        if(!found){
            let info = kyg_subtitles[i];
            let timeInfo = info.time;
            if(kyg_curPos >= timeInfo[0] && kyg_curPos <= timeInfo[1]){
                // ADD ELEMENT!!!
                //console.log("yeah! add a subtitle now!" + kyg_curPos + ", idx:" + i);
                let elt = document.createElement("div");
                elt.className = "kySubtitleItem";
                
                if("color" in info){
                    elt.style.color = info.color;
                }
                let lang = _getLanguage();
                if("text" in info && lang in info.text){
                    elt.innerText = info.text[lang];
                }
                _setSubtitlePosAndSize(elt, info);
                
                kyg_subtitlesState.elt.appendChild(elt);
                
                let item = {elt:elt, info: info, idx: i};
                kyg_subtitlesState.items.push(item);
            }
        }
    }
    for(let i= kyg_subtitlesState.items.length - 1; i>=0; i--){
        let item = kyg_subtitlesState.items[i]; 
        if(kyg_curPos < item.info.time[0] || kyg_curPos > item.info.time[1]){
            kyg_subtitlesState.elt.removeChild(item.elt);
            kyg_subtitlesState.items.pop(i);
        }
    }
}

function kyNextChapterBtnInit(){
    let btn = document.getElementById("kyNextButton");
    
    btn.addEventListener("click", function(e){
        let chapter = _getChapter(kyg_curPos);
        let numC = kyg_scenario.length;
        let state = kyg_player.getPlayerState();
        if(chapter >= 0 && chapter < numC - 1){
            if(state == 1){
                kyPlayerSeek(chapter + 1, 0);
            }
            else if(state == 2){
                kyg_player.seekTo(kyg_scenario[chapter + 1][0]);
            }
        }
    });
}

function kyTimeInfoInit(){
    kyg_timeInfo = document.getElementById('kyTimeInfo');
    let nows = _toTimeStr(0);
    let tots = _toTimeStr(kyg_totTime);
    kyg_timeInfo.innerText = nows + "/" + tots;
}

function kyTimeInfoUpdate(){
    let dtime = _getDigestTime(kyg_curPos);
    if(dtime >= 0){
        let nows = _toTimeStr(dtime);
        let tots = _toTimeStr(kyg_totTime);
        kyg_timeInfo.innerText = nows + "/" + tots;
    }
}


function _addElements(seperator){
    

    let curChapter = 0;
    for(let i=0; i<kyg_scenario.length; i++){
        let s = kyg_scenario[i];
        let s0 = _toTimeStr(s[0]);
        let s1 = _toTimeStr(s[1]);
        let explanation = "";
        if(s.length < 3){
            explanation = "";
        }
        else{
            explanation = s[2];
        }
        
        let elt = document.createElement('div');
        elt.id = "kyt" + i;
        elt.setAttribute("kyFrom", s[0]);
        elt.setAttribute("kyChapter", i);
        
        let timeElt = document.createElement('span');
        timeElt.className = "kyTimestampStr0";
        timeElt.innerText = s0 + "~" + s1 + " ";
        
        let explanationElt = document.createElement('span');
        explanationElt.className = "kyTimestampStr1";
        explanationElt.innerText = explanation;
        
        elt.appendChild(timeElt);
        elt.appendChild(explanationElt);
        
        kyg_timestampState.elements.push(elt);
        
        elt.addEventListener("click", function(e){
            let chapter = parseInt(elt.getAttribute("kyChapter"));
            let jumpTo = parseInt(elt.getAttribute("kyFrom"));
            
            let didit = false;
            let plState = kyg_player.getPlayerState();
            //console.log("timestamp" + chapter + ", " + jumpTo);
            //console.log(e);
            if(plState == 1){
                kyPlayerSeek(i, 0);
                didit = true;
            }
            else if(plState == 2){
                kyg_player.seekTo(jumpTo);
                didit = true;
            }
            
            if(didit){
                window.location = "#kyPlayerContainer";
            }
        });
        
        
        kyg_timestampState.parent.appendChild(elt);
        
        if(i>0 && seperator != null){
            
            let sp = document.createElement("div");
            sp.style.width = "3px";
            sp.style.position = "absolute";
            sp.style.height = "3px";
            sp.style.backgroundColor = "#123";
            sp.style.left = (curChapter / kyg_totTime * 100) + "%";
            sp.style.top = "0px";
            seperator.appendChild(sp);
        }
        curChapter += s[1] - s[0];
    }
}

function kyTimestampInit(){
    kyg_timestampState.parent = document.getElementById("kyTimestamps");
    //kyg_timestampState.lang = _getLanguage();
    //let lang = kyg_timestampState.lang;
    let seperator = document.getElementById("kySeekbarSeperator"); // if null
    kyg_timestampState.titleElt = document.getElementById("kyCurTitle");
    _addElements(seperator);
}

function kyTimestampUpdate(){
    let chapter = _getChapter(kyg_curPos);
    //console.log("aaa kyg_curPos" + kyg_curPos);
    if(kyg_timestampState.idx != chapter){
        kyg_timestampState.idx = chapter;
        for(let i=0; i<kyg_timestampState.elements.length; i++){
            let elt = kyg_timestampState.elements[i];
            let colorStr = "";
            if(i == chapter){
                colorStr = "#e994bb";
            }
            else{
                colorStr = "#ffffff";
            }
            elt.style.backgroundColor = colorStr;
            
        }
        
        if(chapter >= 0 && kyg_timestampState.titleElt != null){
            kyg_timestampState.titleElt.innerText = kyg_scenario[chapter][2];
        }
        
        
    }
}



function _getDigestTime(pos){
    let ret = 0;
    for(let i=0; i<kyg_scenario.length; i++){
        let s = kyg_scenario[i];
        if(pos >= s[0] && pos <= s[1]){
            return ret + pos - s[0];
        }
        else{
            ret += s[1] - s[0];
        }
    }
    
    return -1;
}

function _addSeekbarInfoElt(seekbar){
    let div = document.createElement('div');
    div.innerText = "hello test";
    div.style.position = "fixed";
    div.hidden = true;
    seekbar.addEventListener("mousemove", function(e){
        if(e.srcElement != kyg_seekbarState.elt){
            return;
        }
        div.style.left = (e.clientX + 20) + "px";
        div.style.top =  e.clientY + "px";
        
        ///////////////////////
        // set text! [time:text]
        let pRect = kyg_seekbarState.elt.getBoundingClientRect();
        let t = kyg_totTime * e.offsetX / pRect.width;
        let tstr= _toTimeStr(Math.floor(t));
        
        //console.log(e);
        // fix above!!!!!e.offsetX can be taken from a cursor element, which should be from a seekbar element.
        
        for(let i=0; i<kyg_scenario.length; i++){
            let s = kyg_scenario[i];
            let duration = s[1] - s[0];
            if(t <= duration){
                div.innerText = s[2] + ": " + Math.floor(t / duration * 100) + "%" + " (" + tstr + ")";
                return;
            }
            
            t -= duration;
        }
    });
    seekbar.addEventListener("mouseover", function(e){
        div.hidden = false;
    });
    seekbar.addEventListener("mouseout", function(e){
        div.hidden = true;
    });
    seekbar.appendChild(div);
}

function kySeekbarInit(){
    kyg_seekbarState.elt = document.getElementById("kySeekbar");
    kyg_seekbarState.cursor = document.getElementById("kySeekbarCursor");
    
    _addSeekbarInfoElt(kyg_seekbarState.elt);
    
    kyg_seekbarState.elt.addEventListener("click", function(e){
        if(e.srcElement == kyg_seekbarState.elt){
            let pRect = kyg_seekbarState.elt.getBoundingClientRect();
            let t = kyg_totTime * e.offsetX / pRect.width;

            for(let i=0; i<kyg_scenario.length; i++){
                let s = kyg_scenario[i];
                let duration = s[1] - s[0];
                if(t <= duration){
                    let plState = kyg_player.getPlayerState();
                    if(plState == 1){
                        kyPlayerSeek(i, t);
                    }
                    else if(plState == 2){
                        kyg_player.seekTo(t + s[0]);
                    }
                    
                    return;
                }
                
                t -= duration;
            }
        }
    });
}

function kySeekbarUpdate(){
    let digestPos = _getDigestTime(kyg_curPos);
    if(digestPos >= 0){
        let nextPos = (digestPos / kyg_totTime * 100).toFixed(2);
        if(kyg_seekbarState.pos != nextPos){
            kyg_seekbarState.cursor.style.marginLeft = nextPos.toString() + "%";
            kyg_seekbarState.pos = nextPos;
        }
    }
}


function kyAppInit(initFuncs){
    kyAppCreateFromTemplate(document.getElementById("kyDigestApp"));

    kyg_parentElt = document.getElementById("kyPlayer").parentElement;
    
    //let elt = document.getElementById("kyDigestApp");
    //kyg_videoId = elt.getAttribute("kyVideoId");
    //kyg_scenario = JSON.parse(document.getElementById("kyDataScenario").innerText);
    
    kyg_scenarioRecommended.sort(function(a, b){return a[0] - b[0];})
    
    let cnt = 0;
    for(let i in kyg_scenarioElements){
        cnt++;
    }
    if(cnt == 0){
        document.getElementById("kyScenarioCreator").hidden = true;
    }
    
    document.getElementById("kyAboutDetailBtn").addEventListener("click", function (e){
        document.getElementById("kyAboutDetailBtn").hidden = true;
        document.getElementById("kyAboutDetail").hidden = false;
    });
    
    for(let i=0; i<initFuncs.length; i++){
        initFuncs[i]();
    }

    
}

function kyAppUpdate(updateFuncs){
    kyg_curPos = kyg_player.getCurrentTime();
    
    for(let i=0; i<updateFuncs.length; i++){
        updateFuncs[i]();
    }
    
    setTimeout(kyAppUpdate, 1000 / 30, updateFuncs);
}


function kyPlayerInit(){
    kyg_lastSeekTime = 0;
    kyg_totTime = 0;
    for(let i=0; i<kyg_scenario.length; i++){
        let tmpscenario = kyg_scenario[i];
        kyg_totTime += tmpscenario[1] - tmpscenario[0];
    }
    kyg_seekJobs = [];
    kyg_playStarted = false;
}

function _isInChapter(curPos){
    for(let i=0; i<kyg_scenario.length; i++){
        let s = kyg_scenario[i];
        if(s[0] <= curPos && curPos <= s[1]){
            return true;
        }
    }
    return false;
}
function _getChapter(curPos){
    let ret = -1;
    for(let i=0; i<kyg_scenario.length; i++){
        let s = kyg_scenario[i];
        if(curPos >= s[0] && curPos < s[1]){
            ret = i;
            break;
        }
    }
    
    return ret;
}

function kyPlayerUpdate(){
    if(!kyg_do){
        return;
    }

    let now = new Date().getTime();
    if(kyg_player.getPlayerState() == 1){// PLAYING!
        if(!kyg_playStarted){
            kyg_seekJobs = [{chapter:0, time:0}];
            kyg_playStarted = true;
            
            // set style cursor:pointer to elements.
            kyg_seekbarState.elt.style.cursor = "pointer";
            for(let i=0; i<kyg_timestampState.elements.length; i++){
                kyg_timestampState.elements[i].style.cursor = "pointer";
            }
            
            //console.log("start jump!");
        }
        if(kyg_seekJobs.length == 0 && !_isInChapter(kyg_curPos)){// not in one of the chapters, so the video must go to the next chapter or stop.
            let nextChapter = -1;
            for(let i=0; i<kyg_scenario.length; i++){
                let s = kyg_scenario[i];
                if(kyg_curPos < s[0]){
                    nextChapter = i;
                    break;
                }
            }
            if(nextChapter >= 0){// go to the next chapter
                kyg_seekJobs = [{chapter:nextChapter, time:0}];
                //console.log("next chapter jump cmd" + nextChapter);
            }
            else{// the digest is finished. so pause the video.
                kyg_player.pauseVideo();
                //console.log("fin! and pause!");
            }
        }
        if(now - kyg_lastSeekTime > 1 * 1000 && kyg_seekJobs.length > 0){// the first condition prevents too many seekTo() calls.
            kyg_lastSeekTime = now;
            let dest = kyg_scenario[kyg_seekJobs[0].chapter][0] + kyg_seekJobs[0].time;
            kyg_player.seekTo(dest);
            
            kyg_seekJobs = [];
            //console.log("seekTo called!");
        }
    }
}

function kyPlayerSeek(chapter, timeInChapter){
    if(chapter < 0 || chapter >= kyg_scenario.length){
        return;
    }
    let s = kyg_scenario[chapter];
    if(timeInChapter <= s[1] - s[0]){
        kyg_seekJobs = [{chapter: chapter, time: timeInChapter}];
    }
}

function kyOnPlayerScenarioChanged(){
    if(kyg_playStarted){
        for(let i=0; i<kyg_timestampState.elements.length; i++){
            kyg_timestampState.elements[i].style.cursor = "pointer";
        }
    }
}

function kyOnSeekbarScenarioChanged(){
    // nothing to do
}

function kyOnTimestampsScenarioChanged(){
    let parent = kyg_timestampState.parent;
    let elements = kyg_timestampState.elements;
    for(let i=0; i<elements.length; i++){
        parent.removeChild(elements[i]);
    }
    kyg_timestampState.elements = [];
    
    let seperator = document.getElementById("kySeekbarSeperator");
    if(seperator != null){
        let num = seperator.childElementCount;
        for(let i=0; i<num; i++){
            seperator.removeChild(seperator.children[0]);
        }
    }
    _addElements(seperator)
    kyg_timestampState.idx = -1;
}



function kyScenarioChange(new_scenario){
    if(new_scenario.length == 0){
        return;
    }
    funcs = [kyOnTimestampsScenarioChanged, kyOnSeekbarScenarioChanged, kyOnPlayerScenarioChanged];

    kyg_scenario = new_scenario;
    kyg_totTime = 0;
    for(let i=0; i<kyg_scenario.length; i++){
        let tmpscenario = kyg_scenario[i];
        kyg_totTime += tmpscenario[1] - tmpscenario[0];
    }
    
    for(let i=0; i<funcs.length; i++){
        funcs[i]();
    }
}

function kyOutputBlogStr(){
    let title = kyg_player.getVideoData().title;
    
    let hour= Math.floor(kyg_totTime / 3600);
    let min = Math.floor(kyg_totTime / 60) % 60;
    let sec = Math.floor(kyg_totTime % 60);
    let timeStr = hour + "時間" + ('00' + min).slice(-2) + "分" + ('00' + sec).slice(-2) + "秒";
    let articleText = title + "のダイジェスト(約" + timeStr + ")";
    console.log(articleText);
    
    return articleText;
}


function _getIdealSize(){
    let tmp = kyg_parentElt.getClientRects()[0];
    let tmpWidth = document.documentElement.clientHeight * 16 / 9;
    
    let width = tmp.width;
    if(width > tmpWidth){
        width = tmpWidth;
    }
    return [Math.floor(width), Math.floor(width * 9 / 16)];
}
function _onResize(){
    let size = _getIdealSize();
    kyg_player.setSize(size[0], size[1]);
    //console.log("resized..." + size);
}

function kyBeginDigest(){
    if(_getSpeedFlag()){
        kyAppUpdate([kyPlayerUpdate, kySeekbarUpdate, kyTimestampUpdate, kyTimeInfoUpdate, kySpeedChangerUpdate]);
    }
    else{
        kyAppUpdate([kyPlayerUpdate, kySeekbarUpdate, kyTimestampUpdate, kyTimeInfoUpdate]);
    }
}

function onYouTubeIframeAPIReady(){
    let size = _getIdealSize();
    kyg_player = new YT.Player('kyPlayer', {
        height:size[1].toString(), width:size[0].toString(), videoId:kyg_videoId,
        events: {
            'onReady': kyBeginDigest
        }
    });
}

function main(){
    if(_getSpeedFlag()){
        kyAppInit([kyNextChapterBtnInit, kyPlayerInit, kySeekbarInit, kyTimestampInit, kyTimeInfoInit, kyScenarioCreatorInit, kySpeedChangerInit]);
    }
    else{
        kyAppInit([kyNextChapterBtnInit, kyPlayerInit, kySeekbarInit, kyTimestampInit, kyTimeInfoInit, kyScenarioCreatorInit]);
    }

    window.addEventListener("resize", _onResize);
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

main();
