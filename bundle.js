(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.bundle = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

/**
 * Reduces font size or trims text to make it fit within specified bounds.
 *
 * Supports clamping by number of lines or text height.
 *
 * Known limitations:
 * 1. Characters that distort line heights (emojis, zalgo) may cause
 * unexpected results.
 * 2. Calling {@see hardClamp()} wipes child elements. Future updates may allow
 * inline child elements to be preserved.
 *
 * @todo Split text metrics into own library
 * @todo Test non-LTR text
 */
class LineClamp {
  /**
   * @param {HTMLElement} element
   * The element to clamp.
   *
   * @param {Object} [options]
   * Options to govern clamping behavior.
   *
   * @param {number} [options.maxLines]
   * The maximum number of lines to allow. Defaults to 1.
   * To set a maximum height instead, use {@see options.maxHeight}
   *
   * @param {number} [options.maxHeight]
   * The maximum height (in pixels) of text in an element.
   * This option is undefined by default. Once set, it takes precedence over
   * {@see options.maxLines}. Note that this applies to the height of the text, not
   * the element itself. Restricting the height of the element can be achieved
   * with CSS <code>max-height</code>.
   *
   * @param {boolean} [options.useSoftClamp]
   * If true, reduce font size (soft clamp) to at least {@see options.minFontSize}
   * before resorting to trimming text. Defaults to false.
   *
   * @param {boolean} [options.hardClampAsFallback]
   * If true, resort to hard clamping if soft clamping reaches the minimum font size
   * and still doesn't fit within the max height or number of lines.
   * Defaults to true.
   *
   * @param {string} [options.ellipsis]
   * The character with which to represent clipped trailing text.
   * This option takes effect when "hard" clamping is used.
   *
   * @param {number} [options.minFontSize]
   * The lowest font size, in pixels, to try before resorting to removing
   * trailing text (hard clamping). Defaults to 1.
   *
   * @param {number} [options.maxFontSize]
   * The maximum font size in pixels. We'll start with this font size then
   * reduce until text fits constraints, or font size is equal to
   * {@see options.minFontSize}. Defaults to the element's initial computed font size.
   */
  constructor(
    element,
    {
      maxLines = undefined,
      maxHeight = undefined,
      useSoftClamp = false,
      hardClampAsFallback = true,
      minFontSize = 1,
      maxFontSize = undefined,
      ellipsis = "???",
    } = {}
  ) {
    Object.defineProperty(this, "originalWords", {
      writable: false,
      value: element.textContent.match(/\S+\s*/g) || [],
    });

    Object.defineProperty(this, "updateHandler", {
      writable: false,
      value: () => this.apply(),
    });

    Object.defineProperty(this, "observer", {
      writable: false,
      value: new MutationObserver(this.updateHandler),
    });

    if (undefined === maxFontSize) {
      maxFontSize = parseInt(window.getComputedStyle(element).fontSize, 10);
    }

    this.element = element;
    this.maxLines = maxLines;
    this.maxHeight = maxHeight;
    this.useSoftClamp = useSoftClamp;
    this.hardClampAsFallback = hardClampAsFallback;
    this.minFontSize = minFontSize;
    this.maxFontSize = maxFontSize;
    this.ellipsis = ellipsis;
  }

  /**
   * Gather metrics about the layout of the element's text.
   * This is a somewhat expensive operation - call with care.
   *
   * @returns {TextMetrics}
   * Layout metrics for the clamped element's text.
   */
  calculateTextMetrics() {
    const element = this.element;
    const clone = element.cloneNode(true);
    const style = clone.style;

    // Append, don't replace
    style.cssText += ";min-height:0!important;max-height:none!important";
    element.replaceWith(clone);

    const naturalHeight = clone.offsetHeight;

    // Clear to measure empty height. textContent faster than innerHTML
    clone.textContent = "";

    const naturalHeightWithoutText = clone.offsetHeight;
    const textHeight = naturalHeight - naturalHeightWithoutText;

    // Fill element with single non-breaking space to find height of one line
    clone.textContent = "\xa0";

    // Get height of element with only one line of text
    const naturalHeightWithOneLine = clone.offsetHeight;
    const firstLineHeight = naturalHeightWithOneLine - naturalHeightWithoutText;

    // Add line (<br> + nbsp). appendChild() faster than innerHTML
    clone.appendChild(document.createElement("br"));
    clone.appendChild(document.createTextNode("\xa0"));

    const additionalLineHeight = clone.offsetHeight - naturalHeightWithOneLine;
    const lineCount =
      1 + (naturalHeight - naturalHeightWithOneLine) / additionalLineHeight;

    // Restore original content
    clone.replaceWith(element);

    /**
     * @typedef {Object} TextMetrics
     *
     * @property {textHeight}
     * The vertical space required to display the element's current text.
     * This is <em>not</em> necessarily the same as the height of the element.
     * This number may even be greater than the element's height in cases
     * where the text overflows the element's block axis.
     *
     * @property {naturalHeightWithOneLine}
     * The height of the element with only one line of text and without
     * minimum or maximum heights. This information may be helpful when
     * dealing with inline elements (and potentially other scenarios), where
     * the first line of text does not increase the element's height.
     *
     * @property {firstLineHeight}
     * The height that the first line of text adds to the element, i.e., the
     * difference between the height of the element while empty and the height
     * of the element while it contains one line of text. This number may be
     * zero for inline elements because the first line of text does not
     * increase the height of inline elements.

     * @property {additionalLineHeight}
     * The height that each line of text after the first adds to the element.
     *
     * @property {lineCount}
     * The number of lines of text the element contains.
     */
    return {
      textHeight,
      naturalHeightWithOneLine,
      firstLineHeight,
      additionalLineHeight,
      lineCount,
    }
  }

  /**
   * Watch for changes that may affect layout. Respond by reclamping if
   * necessary.
   */
  watch() {
    if (!this._watching) {
      window.addEventListener("resize", this.updateHandler);

      // Minimum required to detect changes to text nodes,
      // and wholesale replacement via innerHTML
      this.observer.observe(this.element, {
        characterData: true,
        subtree: true,
        childList: true,
        attributes: true,
      });

      this._watching = true;
    }

    return this
  }

  /**
   * Stop watching for layout changes.
   *
   * @returns {LineClamp}
   */
  unwatch() {
    this.observer.disconnect();
    window.removeEventListener("resize", this.updateHandler);

    this._watching = false;

    return this
  }

  /**
   * Conduct either soft clamping or hard clamping, according to the value of
   * property {@see LineClamp.useSoftClamp}.
   */
  apply() {
    if (this.element.offsetHeight) {
      const previouslyWatching = this._watching;

      // Ignore internally started mutations, lest we recurse into oblivion
      this.unwatch();

      this.element.textContent = this.originalWords.join("");

      if (this.useSoftClamp) {
        this.softClamp();
      } else {
        this.hardClamp();
      }

      // Resume observation if previously watching
      if (previouslyWatching) {
        this.watch(false);
      }
    }

    return this
  }

  /**
   * Trims text until it fits within constraints
   * (maximum height or number of lines).
   *
   * @see {LineClamp.maxLines}
   * @see {LineClamp.maxHeight}
   */
  hardClamp(skipCheck = true) {
    if (skipCheck || this.shouldClamp()) {
      let currentText;

      findBoundary(
        1,
        this.originalWords.length,
        (val) => {
          currentText = this.originalWords.slice(0, val).join(" ");
          this.element.textContent = currentText;

          return this.shouldClamp()
        },
        (val, min, max) => {
          // Add one more word if not on max
          if (val > min) {
            currentText = this.originalWords.slice(0, max).join(" ");
          }

          // Then trim letters until it fits
          do {
            currentText = currentText.slice(0, -1);
            this.element.textContent = currentText + this.ellipsis;
          } while (this.shouldClamp())

          // Broadcast more specific hardClamp event first
          emit(this, "lineclamp.hardclamp");
          emit(this, "lineclamp.clamp");
        }
      );
    }

    return this
  }

  /**
   * Reduces font size until text fits within the specified height or number of
   * lines. Resorts to using {@see hardClamp()} if text still exceeds clamp
   * parameters.
   */
  softClamp() {
    const style = this.element.style;
    const startSize = window.getComputedStyle(this.element).fontSize;
    style.fontSize = "";

    let done = false;
    let shouldClamp;

    findBoundary(
      this.minFontSize,
      this.maxFontSize,
      (val) => {
        style.fontSize = val + "px";
        shouldClamp = this.shouldClamp();
        return shouldClamp
      },
      (val, min) => {
        if (val > min) {
          style.fontSize = min + "px";
          shouldClamp = this.shouldClamp();
        }
        done = !shouldClamp;
      }
    );

    const changed = style.fontSize !== startSize;

    // Emit specific softClamp event first
    if (changed) {
      emit(this, "lineclamp.softclamp");
    }

    // Don't emit `lineclamp.clamp` event twice.
    if (!done && this.hardClampAsFallback) {
      this.hardClamp(false);
    } else if (changed) {
      // hardClamp emits `lineclamp.clamp` too. Only emit from here if we're
      // not also hard clamping.
      emit(this, "lineclamp.clamp");
    }

    return this
  }

  /**
   * @returns {boolean}
   * Whether height of text or number of lines exceed constraints.
   *
   * @see LineClamp.maxHeight
   * @see LineClamp.maxLines
   */
  shouldClamp() {
    const { lineCount, textHeight } = this.calculateTextMetrics();

    if (undefined !== this.maxHeight && undefined !== this.maxLines) {
      return textHeight > this.maxHeight || lineCount > this.maxLines
    }

    if (undefined !== this.maxHeight) {
      return textHeight > this.maxHeight
    }

    if (undefined !== this.maxLines) {
      return lineCount > this.maxLines
    }

    throw new Error(
      "maxLines or maxHeight must be set before calling shouldClamp()."
    )
  }
}

/**
 * Performs a binary search for the point in a contigous range where a given
 * test callback will go from returning true to returning false.
 *
 * Since this uses a binary-search algorithm this is an O(log n) function,
 * where n = max - min.
 *
 * @param {Number} min
 * The lower boundary of the range.
 *
 * @param {Number} max
 * The upper boundary of the range.
 *
 * @param test
 * A callback that receives the current value in the range and returns a truthy or falsy value.
 *
 * @param done
 * A function to perform when complete. Receives the following parameters
 * - cursor
 * - maxPassingValue
 * - minFailingValue
 */
function findBoundary(min, max, test, done) {
  // start halfway through the range
  let cursor = (min + max) / 2;

  while (max > min) {
    if (test(cursor)) {
      max = cursor;
    } else {
      min = cursor;
    }

    if (max - min === 1) {
      done(cursor, min, max);
      break
    }

    cursor = Math.floor((min + max) / 2);
  }
}

function emit(instance, type) {
  instance.element.dispatchEvent(new CustomEvent(type));
}

module.exports = LineClamp;

},{}],2:[function(require,module,exports){
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self).dayjs=e()}(this,(function(){"use strict";var t=1e3,e=6e4,n=36e5,r="millisecond",i="second",s="minute",u="hour",a="day",o="week",f="month",h="quarter",c="year",d="date",$="Invalid Date",l=/^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/,y=/\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,M={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},m=function(t,e,n){var r=String(t);return!r||r.length>=e?t:""+Array(e+1-r.length).join(n)+t},g={s:m,z:function(t){var e=-t.utcOffset(),n=Math.abs(e),r=Math.floor(n/60),i=n%60;return(e<=0?"+":"-")+m(r,2,"0")+":"+m(i,2,"0")},m:function t(e,n){if(e.date()<n.date())return-t(n,e);var r=12*(n.year()-e.year())+(n.month()-e.month()),i=e.clone().add(r,f),s=n-i<0,u=e.clone().add(r+(s?-1:1),f);return+(-(r+(n-i)/(s?i-u:u-i))||0)},a:function(t){return t<0?Math.ceil(t)||0:Math.floor(t)},p:function(t){return{M:f,y:c,w:o,d:a,D:d,h:u,m:s,s:i,ms:r,Q:h}[t]||String(t||"").toLowerCase().replace(/s$/,"")},u:function(t){return void 0===t}},D="en",v={};v[D]=M;var p=function(t){return t instanceof _},S=function(t,e,n){var r;if(!t)return D;if("string"==typeof t)v[t]&&(r=t),e&&(v[t]=e,r=t);else{var i=t.name;v[i]=t,r=i}return!n&&r&&(D=r),r||!n&&D},w=function(t,e){if(p(t))return t.clone();var n="object"==typeof e?e:{};return n.date=t,n.args=arguments,new _(n)},O=g;O.l=S,O.i=p,O.w=function(t,e){return w(t,{locale:e.$L,utc:e.$u,x:e.$x,$offset:e.$offset})};var _=function(){function M(t){this.$L=S(t.locale,null,!0),this.parse(t)}var m=M.prototype;return m.parse=function(t){this.$d=function(t){var e=t.date,n=t.utc;if(null===e)return new Date(NaN);if(O.u(e))return new Date;if(e instanceof Date)return new Date(e);if("string"==typeof e&&!/Z$/i.test(e)){var r=e.match(l);if(r){var i=r[2]-1||0,s=(r[7]||"0").substring(0,3);return n?new Date(Date.UTC(r[1],i,r[3]||1,r[4]||0,r[5]||0,r[6]||0,s)):new Date(r[1],i,r[3]||1,r[4]||0,r[5]||0,r[6]||0,s)}}return new Date(e)}(t),this.$x=t.x||{},this.init()},m.init=function(){var t=this.$d;this.$y=t.getFullYear(),this.$M=t.getMonth(),this.$D=t.getDate(),this.$W=t.getDay(),this.$H=t.getHours(),this.$m=t.getMinutes(),this.$s=t.getSeconds(),this.$ms=t.getMilliseconds()},m.$utils=function(){return O},m.isValid=function(){return!(this.$d.toString()===$)},m.isSame=function(t,e){var n=w(t);return this.startOf(e)<=n&&n<=this.endOf(e)},m.isAfter=function(t,e){return w(t)<this.startOf(e)},m.isBefore=function(t,e){return this.endOf(e)<w(t)},m.$g=function(t,e,n){return O.u(t)?this[e]:this.set(n,t)},m.unix=function(){return Math.floor(this.valueOf()/1e3)},m.valueOf=function(){return this.$d.getTime()},m.startOf=function(t,e){var n=this,r=!!O.u(e)||e,h=O.p(t),$=function(t,e){var i=O.w(n.$u?Date.UTC(n.$y,e,t):new Date(n.$y,e,t),n);return r?i:i.endOf(a)},l=function(t,e){return O.w(n.toDate()[t].apply(n.toDate("s"),(r?[0,0,0,0]:[23,59,59,999]).slice(e)),n)},y=this.$W,M=this.$M,m=this.$D,g="set"+(this.$u?"UTC":"");switch(h){case c:return r?$(1,0):$(31,11);case f:return r?$(1,M):$(0,M+1);case o:var D=this.$locale().weekStart||0,v=(y<D?y+7:y)-D;return $(r?m-v:m+(6-v),M);case a:case d:return l(g+"Hours",0);case u:return l(g+"Minutes",1);case s:return l(g+"Seconds",2);case i:return l(g+"Milliseconds",3);default:return this.clone()}},m.endOf=function(t){return this.startOf(t,!1)},m.$set=function(t,e){var n,o=O.p(t),h="set"+(this.$u?"UTC":""),$=(n={},n[a]=h+"Date",n[d]=h+"Date",n[f]=h+"Month",n[c]=h+"FullYear",n[u]=h+"Hours",n[s]=h+"Minutes",n[i]=h+"Seconds",n[r]=h+"Milliseconds",n)[o],l=o===a?this.$D+(e-this.$W):e;if(o===f||o===c){var y=this.clone().set(d,1);y.$d[$](l),y.init(),this.$d=y.set(d,Math.min(this.$D,y.daysInMonth())).$d}else $&&this.$d[$](l);return this.init(),this},m.set=function(t,e){return this.clone().$set(t,e)},m.get=function(t){return this[O.p(t)]()},m.add=function(r,h){var d,$=this;r=Number(r);var l=O.p(h),y=function(t){var e=w($);return O.w(e.date(e.date()+Math.round(t*r)),$)};if(l===f)return this.set(f,this.$M+r);if(l===c)return this.set(c,this.$y+r);if(l===a)return y(1);if(l===o)return y(7);var M=(d={},d[s]=e,d[u]=n,d[i]=t,d)[l]||1,m=this.$d.getTime()+r*M;return O.w(m,this)},m.subtract=function(t,e){return this.add(-1*t,e)},m.format=function(t){var e=this,n=this.$locale();if(!this.isValid())return n.invalidDate||$;var r=t||"YYYY-MM-DDTHH:mm:ssZ",i=O.z(this),s=this.$H,u=this.$m,a=this.$M,o=n.weekdays,f=n.months,h=function(t,n,i,s){return t&&(t[n]||t(e,r))||i[n].substr(0,s)},c=function(t){return O.s(s%12||12,t,"0")},d=n.meridiem||function(t,e,n){var r=t<12?"AM":"PM";return n?r.toLowerCase():r},l={YY:String(this.$y).slice(-2),YYYY:this.$y,M:a+1,MM:O.s(a+1,2,"0"),MMM:h(n.monthsShort,a,f,3),MMMM:h(f,a),D:this.$D,DD:O.s(this.$D,2,"0"),d:String(this.$W),dd:h(n.weekdaysMin,this.$W,o,2),ddd:h(n.weekdaysShort,this.$W,o,3),dddd:o[this.$W],H:String(s),HH:O.s(s,2,"0"),h:c(1),hh:c(2),a:d(s,u,!0),A:d(s,u,!1),m:String(u),mm:O.s(u,2,"0"),s:String(this.$s),ss:O.s(this.$s,2,"0"),SSS:O.s(this.$ms,3,"0"),Z:i};return r.replace(y,(function(t,e){return e||l[t]||i.replace(":","")}))},m.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},m.diff=function(r,d,$){var l,y=O.p(d),M=w(r),m=(M.utcOffset()-this.utcOffset())*e,g=this-M,D=O.m(this,M);return D=(l={},l[c]=D/12,l[f]=D,l[h]=D/3,l[o]=(g-m)/6048e5,l[a]=(g-m)/864e5,l[u]=g/n,l[s]=g/e,l[i]=g/t,l)[y]||g,$?D:O.a(D)},m.daysInMonth=function(){return this.endOf(f).$D},m.$locale=function(){return v[this.$L]},m.locale=function(t,e){if(!t)return this.$L;var n=this.clone(),r=S(t,e,!0);return r&&(n.$L=r),n},m.clone=function(){return O.w(this.$d,this)},m.toDate=function(){return new Date(this.valueOf())},m.toJSON=function(){return this.isValid()?this.toISOString():null},m.toISOString=function(){return this.$d.toISOString()},m.toString=function(){return this.$d.toUTCString()},M}(),b=_.prototype;return w.prototype=b,[["$ms",r],["$s",i],["$m",s],["$H",u],["$W",a],["$M",f],["$y",c],["$D",d]].forEach((function(t){b[t[1]]=function(e){return this.$g(e,t[0],t[1])}})),w.extend=function(t,e){return t.$i||(t(e,_,w),t.$i=!0),w},w.locale=S,w.isDayjs=p,w.unix=function(t){return w(1e3*t)},w.en=v[D],w.Ls=v,w.p={},w}));
},{}],3:[function(require,module,exports){
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self).dayjs_plugin_customParseFormat=e()}(this,(function(){"use strict";var t={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},e=/(\[[^[]*\])|([-:/.()\s]+)|(A|a|YYYY|YY?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,n=/\d\d/,r=/\d\d?/,i=/\d*[^\s\d-_:/()]+/,o={},s=function(t){return(t=+t)+(t>68?1900:2e3)};var a=function(t){return function(e){this[t]=+e}},f=[/[+-]\d\d:?(\d\d)?|Z/,function(t){(this.zone||(this.zone={})).offset=function(t){if(!t)return 0;if("Z"===t)return 0;var e=t.match(/([+-]|\d\d)/g),n=60*e[1]+(+e[2]||0);return 0===n?0:"+"===e[0]?-n:n}(t)}],u=function(t){var e=o[t];return e&&(e.indexOf?e:e.s.concat(e.f))},h=function(t,e){var n,r=o.meridiem;if(r){for(var i=1;i<=24;i+=1)if(t.indexOf(r(i,0,e))>-1){n=i>12;break}}else n=t===(e?"pm":"PM");return n},d={A:[i,function(t){this.afternoon=h(t,!1)}],a:[i,function(t){this.afternoon=h(t,!0)}],S:[/\d/,function(t){this.milliseconds=100*+t}],SS:[n,function(t){this.milliseconds=10*+t}],SSS:[/\d{3}/,function(t){this.milliseconds=+t}],s:[r,a("seconds")],ss:[r,a("seconds")],m:[r,a("minutes")],mm:[r,a("minutes")],H:[r,a("hours")],h:[r,a("hours")],HH:[r,a("hours")],hh:[r,a("hours")],D:[r,a("day")],DD:[n,a("day")],Do:[i,function(t){var e=o.ordinal,n=t.match(/\d+/);if(this.day=n[0],e)for(var r=1;r<=31;r+=1)e(r).replace(/\[|\]/g,"")===t&&(this.day=r)}],M:[r,a("month")],MM:[n,a("month")],MMM:[i,function(t){var e=u("months"),n=(u("monthsShort")||e.map((function(t){return t.substr(0,3)}))).indexOf(t)+1;if(n<1)throw new Error;this.month=n%12||n}],MMMM:[i,function(t){var e=u("months").indexOf(t)+1;if(e<1)throw new Error;this.month=e%12||e}],Y:[/[+-]?\d+/,a("year")],YY:[n,function(t){this.year=s(t)}],YYYY:[/\d{4}/,a("year")],Z:f,ZZ:f};function c(n){var r,i;r=n,i=o&&o.formats;for(var s=(n=r.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,(function(e,n,r){var o=r&&r.toUpperCase();return n||i[r]||t[r]||i[o].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,(function(t,e,n){return e||n.slice(1)}))}))).match(e),a=s.length,f=0;f<a;f+=1){var u=s[f],h=d[u],c=h&&h[0],l=h&&h[1];s[f]=l?{regex:c,parser:l}:u.replace(/^\[|\]$/g,"")}return function(t){for(var e={},n=0,r=0;n<a;n+=1){var i=s[n];if("string"==typeof i)r+=i.length;else{var o=i.regex,f=i.parser,u=t.substr(r),h=o.exec(u)[0];f.call(e,h),t=t.replace(h,"")}}return function(t){var e=t.afternoon;if(void 0!==e){var n=t.hours;e?n<12&&(t.hours+=12):12===n&&(t.hours=0),delete t.afternoon}}(e),e}}return function(t,e,n){n.p.customParseFormat=!0,t&&t.parseTwoDigitYear&&(s=t.parseTwoDigitYear);var r=e.prototype,i=r.parse;r.parse=function(t){var e=t.date,r=t.utc,s=t.args;this.$u=r;var a=s[1];if("string"==typeof a){var f=!0===s[2],u=!0===s[3],h=f||u,d=s[2];u&&(d=s[2]),o=this.$locale(),!f&&d&&(o=n.Ls[d]),this.$d=function(t,e,n){try{if(["x","X"].indexOf(e)>-1)return new Date(("X"===e?1e3:1)*t);var r=c(e)(t),i=r.year,o=r.month,s=r.day,a=r.hours,f=r.minutes,u=r.seconds,h=r.milliseconds,d=r.zone,l=new Date,m=s||(i||o?1:l.getDate()),M=i||l.getFullYear(),Y=0;i&&!o||(Y=o>0?o-1:l.getMonth());var p=a||0,v=f||0,D=u||0,g=h||0;return d?new Date(Date.UTC(M,Y,m,p,v,D,g+60*d.offset*1e3)):n?new Date(Date.UTC(M,Y,m,p,v,D,g)):new Date(M,Y,m,p,v,D,g)}catch(t){return new Date("")}}(e,a,r),this.init(),d&&!0!==d&&(this.$L=this.locale(d).$L),h&&e!==this.format(a)&&(this.$d=new Date("")),o={}}else if(a instanceof Array)for(var l=a.length,m=1;m<=l;m+=1){s[1]=a[m-1];var M=n.apply(this,s);if(M.isValid()){this.$d=M.$d,this.$L=M.$L,this.init();break}m===l&&(this.$d=new Date(""))}else i.call(this,t)}}}));
},{}],4:[function(require,module,exports){
module.exports = function (list) {
  var addAsync = function (values, callback, items) {
    var valuesToAdd = values.splice(0, 50)
    items = items || []
    items = items.concat(list.add(valuesToAdd))
    if (values.length > 0) {
      setTimeout(function () {
        addAsync(values, callback, items)
      }, 1)
    } else {
      list.update()
      callback(items)
    }
  }
  return addAsync
}

},{}],5:[function(require,module,exports){
module.exports = function (list) {
  // Add handlers
  list.handlers.filterStart = list.handlers.filterStart || []
  list.handlers.filterComplete = list.handlers.filterComplete || []

  return function (filterFunction) {
    list.trigger('filterStart')
    list.i = 1 // Reset paging
    list.reset.filter()
    if (filterFunction === undefined) {
      list.filtered = false
    } else {
      list.filtered = true
      var is = list.items
      for (var i = 0, il = is.length; i < il; i++) {
        var item = is[i]
        if (filterFunction(item)) {
          item.filtered = true
        } else {
          item.filtered = false
        }
      }
    }
    list.update()
    list.trigger('filterComplete')
    return list.visibleItems
  }
}

},{}],6:[function(require,module,exports){
var classes = require('./utils/classes'),
  events = require('./utils/events'),
  extend = require('./utils/extend'),
  toString = require('./utils/to-string'),
  getByClass = require('./utils/get-by-class'),
  fuzzy = require('./utils/fuzzy')

module.exports = function (list, options) {
  options = options || {}

  options = extend(
    {
      location: 0,
      distance: 100,
      threshold: 0.4,
      multiSearch: true,
      searchClass: 'fuzzy-search',
    },
    options
  )

  var fuzzySearch = {
    search: function (searchString, columns) {
      // Substract arguments from the searchString or put searchString as only argument
      var searchArguments = options.multiSearch ? searchString.replace(/ +$/, '').split(/ +/) : [searchString]

      for (var k = 0, kl = list.items.length; k < kl; k++) {
        fuzzySearch.item(list.items[k], columns, searchArguments)
      }
    },
    item: function (item, columns, searchArguments) {
      var found = true
      for (var i = 0; i < searchArguments.length; i++) {
        var foundArgument = false
        for (var j = 0, jl = columns.length; j < jl; j++) {
          if (fuzzySearch.values(item.values(), columns[j], searchArguments[i])) {
            foundArgument = true
          }
        }
        if (!foundArgument) {
          found = false
        }
      }
      item.found = found
    },
    values: function (values, value, searchArgument) {
      if (values.hasOwnProperty(value)) {
        var text = toString(values[value]).toLowerCase()

        if (fuzzy(text, searchArgument, options)) {
          return true
        }
      }
      return false
    },
  }

  events.bind(
    getByClass(list.listContainer, options.searchClass),
    'keyup',
    list.utils.events.debounce(function (e) {
      var target = e.target || e.srcElement // IE have srcElement
      list.search(target.value, fuzzySearch.search)
    }, list.searchDelay)
  )

  return function (str, columns) {
    list.search(str, columns, fuzzySearch.search)
  }
}

},{"./utils/classes":14,"./utils/events":15,"./utils/extend":16,"./utils/fuzzy":17,"./utils/get-by-class":19,"./utils/to-string":22}],7:[function(require,module,exports){
var naturalSort = require('string-natural-compare'),
  getByClass = require('./utils/get-by-class'),
  extend = require('./utils/extend'),
  indexOf = require('./utils/index-of'),
  events = require('./utils/events'),
  toString = require('./utils/to-string'),
  classes = require('./utils/classes'),
  getAttribute = require('./utils/get-attribute'),
  toArray = require('./utils/to-array')

module.exports = function (id, options, values) {
  var self = this,
    init,
    Item = require('./item')(self),
    addAsync = require('./add-async')(self),
    initPagination = require('./pagination')(self)

  init = {
    start: function () {
      self.listClass = 'list'
      self.searchClass = 'search'
      self.sortClass = 'sort'
      self.page = 10000
      self.i = 1
      self.items = []
      self.visibleItems = []
      self.matchingItems = []
      self.searched = false
      self.filtered = false
      self.searchColumns = undefined
      self.searchDelay = 0
      self.handlers = { updated: [] }
      self.valueNames = []
      self.utils = {
        getByClass: getByClass,
        extend: extend,
        indexOf: indexOf,
        events: events,
        toString: toString,
        naturalSort: naturalSort,
        classes: classes,
        getAttribute: getAttribute,
        toArray: toArray,
      }

      self.utils.extend(self, options)

      self.listContainer = typeof id === 'string' ? document.getElementById(id) : id
      if (!self.listContainer) {
        return
      }
      self.list = getByClass(self.listContainer, self.listClass, true)

      self.parse = require('./parse')(self)
      self.templater = require('./templater')(self)
      self.search = require('./search')(self)
      self.filter = require('./filter')(self)
      self.sort = require('./sort')(self)
      self.fuzzySearch = require('./fuzzy-search')(self, options.fuzzySearch)

      this.handlers()
      this.items()
      this.pagination()

      self.update()
    },
    handlers: function () {
      for (var handler in self.handlers) {
        if (self[handler] && self.handlers.hasOwnProperty(handler)) {
          self.on(handler, self[handler])
        }
      }
    },
    items: function () {
      self.parse(self.list)
      if (values !== undefined) {
        self.add(values)
      }
    },
    pagination: function () {
      if (options.pagination !== undefined) {
        if (options.pagination === true) {
          options.pagination = [{}]
        }
        if (options.pagination[0] === undefined) {
          options.pagination = [options.pagination]
        }
        for (var i = 0, il = options.pagination.length; i < il; i++) {
          initPagination(options.pagination[i])
        }
      }
    },
  }

  /*
   * Re-parse the List, use if html have changed
   */
  this.reIndex = function () {
    self.items = []
    self.visibleItems = []
    self.matchingItems = []
    self.searched = false
    self.filtered = false
    self.parse(self.list)
  }

  this.toJSON = function () {
    var json = []
    for (var i = 0, il = self.items.length; i < il; i++) {
      json.push(self.items[i].values())
    }
    return json
  }

  /*
   * Add object to list
   */
  this.add = function (values, callback) {
    if (values.length === 0) {
      return
    }
    if (callback) {
      addAsync(values.slice(0), callback)
      return
    }
    var added = [],
      notCreate = false
    if (values[0] === undefined) {
      values = [values]
    }
    for (var i = 0, il = values.length; i < il; i++) {
      var item = null
      notCreate = self.items.length > self.page ? true : false
      item = new Item(values[i], undefined, notCreate)
      self.items.push(item)
      added.push(item)
    }
    self.update()
    return added
  }

  this.show = function (i, page) {
    this.i = i
    this.page = page
    self.update()
    return self
  }

  /* Removes object from list.
   * Loops through the list and removes objects where
   * property "valuename" === value
   */
  this.remove = function (valueName, value, options) {
    var found = 0
    for (var i = 0, il = self.items.length; i < il; i++) {
      if (self.items[i].values()[valueName] == value) {
        self.templater.remove(self.items[i], options)
        self.items.splice(i, 1)
        il--
        i--
        found++
      }
    }
    self.update()
    return found
  }

  /* Gets the objects in the list which
   * property "valueName" === value
   */
  this.get = function (valueName, value) {
    var matchedItems = []
    for (var i = 0, il = self.items.length; i < il; i++) {
      var item = self.items[i]
      if (item.values()[valueName] == value) {
        matchedItems.push(item)
      }
    }
    return matchedItems
  }

  /*
   * Get size of the list
   */
  this.size = function () {
    return self.items.length
  }

  /*
   * Removes all items from the list
   */
  this.clear = function () {
    self.templater.clear()
    self.items = []
    return self
  }

  this.on = function (event, callback) {
    self.handlers[event].push(callback)
    return self
  }

  this.off = function (event, callback) {
    var e = self.handlers[event]
    var index = indexOf(e, callback)
    if (index > -1) {
      e.splice(index, 1)
    }
    return self
  }

  this.trigger = function (event) {
    var i = self.handlers[event].length
    while (i--) {
      self.handlers[event][i](self)
    }
    return self
  }

  this.reset = {
    filter: function () {
      var is = self.items,
        il = is.length
      while (il--) {
        is[il].filtered = false
      }
      return self
    },
    search: function () {
      var is = self.items,
        il = is.length
      while (il--) {
        is[il].found = false
      }
      return self
    },
  }

  this.update = function () {
    var is = self.items,
      il = is.length

    self.visibleItems = []
    self.matchingItems = []
    self.templater.clear()
    for (var i = 0; i < il; i++) {
      if (is[i].matching() && self.matchingItems.length + 1 >= self.i && self.visibleItems.length < self.page) {
        is[i].show()
        self.visibleItems.push(is[i])
        self.matchingItems.push(is[i])
      } else if (is[i].matching()) {
        self.matchingItems.push(is[i])
        is[i].hide()
      } else {
        is[i].hide()
      }
    }
    self.trigger('updated')
    return self
  }

  init.start()
}

},{"./add-async":4,"./filter":5,"./fuzzy-search":6,"./item":8,"./pagination":9,"./parse":10,"./search":11,"./sort":12,"./templater":13,"./utils/classes":14,"./utils/events":15,"./utils/extend":16,"./utils/get-attribute":18,"./utils/get-by-class":19,"./utils/index-of":20,"./utils/to-array":21,"./utils/to-string":22,"string-natural-compare":23}],8:[function(require,module,exports){
module.exports = function (list) {
  return function (initValues, element, notCreate) {
    var item = this

    this._values = {}

    this.found = false // Show if list.searched == true and this.found == true
    this.filtered = false // Show if list.filtered == true and this.filtered == true

    var init = function (initValues, element, notCreate) {
      if (element === undefined) {
        if (notCreate) {
          item.values(initValues, notCreate)
        } else {
          item.values(initValues)
        }
      } else {
        item.elm = element
        var values = list.templater.get(item, initValues)
        item.values(values)
      }
    }

    this.values = function (newValues, notCreate) {
      if (newValues !== undefined) {
        for (var name in newValues) {
          item._values[name] = newValues[name]
        }
        if (notCreate !== true) {
          list.templater.set(item, item.values())
        }
      } else {
        return item._values
      }
    }

    this.show = function () {
      list.templater.show(item)
    }

    this.hide = function () {
      list.templater.hide(item)
    }

    this.matching = function () {
      return (
        (list.filtered && list.searched && item.found && item.filtered) ||
        (list.filtered && !list.searched && item.filtered) ||
        (!list.filtered && list.searched && item.found) ||
        (!list.filtered && !list.searched)
      )
    }

    this.visible = function () {
      return item.elm && item.elm.parentNode == list.list ? true : false
    }

    init(initValues, element, notCreate)
  }
}

},{}],9:[function(require,module,exports){
var classes = require('./utils/classes'),
  events = require('./utils/events'),
  List = require('./index')

module.exports = function (list) {
  var isHidden = false

  var refresh = function (pagingList, options) {
    if (list.page < 1) {
      list.listContainer.style.display = 'none'
      isHidden = true
      return
    } else if (isHidden) {
      list.listContainer.style.display = 'block'
    }

    var item,
      l = list.matchingItems.length,
      index = list.i,
      page = list.page,
      pages = Math.ceil(l / page),
      currentPage = Math.ceil(index / page),
      innerWindow = options.innerWindow || 2,
      left = options.left || options.outerWindow || 0,
      right = options.right || options.outerWindow || 0

    right = pages - right
    pagingList.clear()
    for (var i = 1; i <= pages; i++) {
      var className = currentPage === i ? 'active' : ''

      //console.log(i, left, right, currentPage, (currentPage - innerWindow), (currentPage + innerWindow), className);

      if (is.number(i, left, right, currentPage, innerWindow)) {
        item = pagingList.add({
          page: i,
          dotted: false,
        })[0]
        if (className) {
          classes(item.elm).add(className)
        }
        item.elm.firstChild.setAttribute('data-i', i)
        item.elm.firstChild.setAttribute('data-page', page)
      } else if (is.dotted(pagingList, i, left, right, currentPage, innerWindow, pagingList.size())) {
        item = pagingList.add({
          page: '...',
          dotted: true,
        })[0]
        classes(item.elm).add('disabled')
      }
    }
  }

  var is = {
    number: function (i, left, right, currentPage, innerWindow) {
      return this.left(i, left) || this.right(i, right) || this.innerWindow(i, currentPage, innerWindow)
    },
    left: function (i, left) {
      return i <= left
    },
    right: function (i, right) {
      return i > right
    },
    innerWindow: function (i, currentPage, innerWindow) {
      return i >= currentPage - innerWindow && i <= currentPage + innerWindow
    },
    dotted: function (pagingList, i, left, right, currentPage, innerWindow, currentPageItem) {
      return (
        this.dottedLeft(pagingList, i, left, right, currentPage, innerWindow) ||
        this.dottedRight(pagingList, i, left, right, currentPage, innerWindow, currentPageItem)
      )
    },
    dottedLeft: function (pagingList, i, left, right, currentPage, innerWindow) {
      return i == left + 1 && !this.innerWindow(i, currentPage, innerWindow) && !this.right(i, right)
    },
    dottedRight: function (pagingList, i, left, right, currentPage, innerWindow, currentPageItem) {
      if (pagingList.items[currentPageItem - 1].values().dotted) {
        return false
      } else {
        return i == right && !this.innerWindow(i, currentPage, innerWindow) && !this.right(i, right)
      }
    },
  }

  return function (options) {
    var pagingList = new List(list.listContainer.id, {
      listClass: options.paginationClass || 'pagination',
      item: options.item || "<li><a class='page' href='#'></a></li>",
      valueNames: ['page', 'dotted'],
      searchClass: 'pagination-search-that-is-not-supposed-to-exist',
      sortClass: 'pagination-sort-that-is-not-supposed-to-exist',
    })

    events.bind(pagingList.listContainer, 'click', function (e) {
      var target = e.target || e.srcElement,
        page = list.utils.getAttribute(target, 'data-page'),
        i = list.utils.getAttribute(target, 'data-i')
      if (i) {
        list.show((i - 1) * page + 1, page)
      }
    })

    list.on('updated', function () {
      refresh(pagingList, options)
    })
    refresh(pagingList, options)
  }
}

},{"./index":7,"./utils/classes":14,"./utils/events":15}],10:[function(require,module,exports){
module.exports = function (list) {
  var Item = require('./item')(list)

  var getChildren = function (parent) {
    var nodes = parent.childNodes,
      items = []
    for (var i = 0, il = nodes.length; i < il; i++) {
      // Only textnodes have a data attribute
      if (nodes[i].data === undefined) {
        items.push(nodes[i])
      }
    }
    return items
  }

  var parse = function (itemElements, valueNames) {
    for (var i = 0, il = itemElements.length; i < il; i++) {
      list.items.push(new Item(valueNames, itemElements[i]))
    }
  }
  var parseAsync = function (itemElements, valueNames) {
    var itemsToIndex = itemElements.splice(0, 50) // TODO: If < 100 items, what happens in IE etc?
    parse(itemsToIndex, valueNames)
    if (itemElements.length > 0) {
      setTimeout(function () {
        parseAsync(itemElements, valueNames)
      }, 1)
    } else {
      list.update()
      list.trigger('parseComplete')
    }
  }

  list.handlers.parseComplete = list.handlers.parseComplete || []

  return function () {
    var itemsToIndex = getChildren(list.list),
      valueNames = list.valueNames

    if (list.indexAsync) {
      parseAsync(itemsToIndex, valueNames)
    } else {
      parse(itemsToIndex, valueNames)
    }
  }
}

},{"./item":8}],11:[function(require,module,exports){
module.exports = function (list) {
  var item, text, columns, searchString, customSearch

  var prepare = {
    resetList: function () {
      list.i = 1
      list.templater.clear()
      customSearch = undefined
    },
    setOptions: function (args) {
      if (args.length == 2 && args[1] instanceof Array) {
        columns = args[1]
      } else if (args.length == 2 && typeof args[1] == 'function') {
        columns = undefined
        customSearch = args[1]
      } else if (args.length == 3) {
        columns = args[1]
        customSearch = args[2]
      } else {
        columns = undefined
      }
    },
    setColumns: function () {
      if (list.items.length === 0) return
      if (columns === undefined) {
        columns = list.searchColumns === undefined ? prepare.toArray(list.items[0].values()) : list.searchColumns
      }
    },
    setSearchString: function (s) {
      s = list.utils.toString(s).toLowerCase()
      s = s.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&') // Escape regular expression characters
      searchString = s
    },
    toArray: function (values) {
      var tmpColumn = []
      for (var name in values) {
        tmpColumn.push(name)
      }
      return tmpColumn
    },
  }
  var search = {
    list: function () {
      // Extract quoted phrases "word1 word2" from original searchString
      // searchString is converted to lowercase by List.js
      var words = [],
        phrase,
        ss = searchString
      while ((phrase = ss.match(/"([^"]+)"/)) !== null) {
        words.push(phrase[1])
        ss = ss.substring(0, phrase.index) + ss.substring(phrase.index + phrase[0].length)
      }
      // Get remaining space-separated words (if any)
      ss = ss.trim()
      if (ss.length) words = words.concat(ss.split(/\s+/))
      for (var k = 0, kl = list.items.length; k < kl; k++) {
        var item = list.items[k]
        item.found = false
        if (!words.length) continue
        for (var i = 0, il = words.length; i < il; i++) {
          var word_found = false
          for (var j = 0, jl = columns.length; j < jl; j++) {
            var values = item.values(),
              column = columns[j]
            if (values.hasOwnProperty(column) && values[column] !== undefined && values[column] !== null) {
              var text = typeof values[column] !== 'string' ? values[column].toString() : values[column]
              if (text.toLowerCase().indexOf(words[i]) !== -1) {
                // word found, so no need to check it against any other columns
                word_found = true
                break
              }
            }
          }
          // this word not found? no need to check any other words, the item cannot match
          if (!word_found) break
        }
        item.found = word_found
      }
    },
    // Removed search.item() and search.values()
    reset: function () {
      list.reset.search()
      list.searched = false
    },
  }

  var searchMethod = function (str) {
    list.trigger('searchStart')

    prepare.resetList()
    prepare.setSearchString(str)
    prepare.setOptions(arguments) // str, cols|searchFunction, searchFunction
    prepare.setColumns()

    if (searchString === '') {
      search.reset()
    } else {
      list.searched = true
      if (customSearch) {
        customSearch(searchString, columns)
      } else {
        search.list()
      }
    }

    list.update()
    list.trigger('searchComplete')
    return list.visibleItems
  }

  list.handlers.searchStart = list.handlers.searchStart || []
  list.handlers.searchComplete = list.handlers.searchComplete || []

  list.utils.events.bind(
    list.utils.getByClass(list.listContainer, list.searchClass),
    'keyup',
    list.utils.events.debounce(function (e) {
      var target = e.target || e.srcElement, // IE have srcElement
        alreadyCleared = target.value === '' && !list.searched
      if (!alreadyCleared) {
        // If oninput already have resetted the list, do nothing
        searchMethod(target.value)
      }
    }, list.searchDelay)
  )

  // Used to detect click on HTML5 clear button
  list.utils.events.bind(list.utils.getByClass(list.listContainer, list.searchClass), 'input', function (e) {
    var target = e.target || e.srcElement
    if (target.value === '') {
      searchMethod('')
    }
  })

  return searchMethod
}

},{}],12:[function(require,module,exports){
module.exports = function (list) {
  var buttons = {
    els: undefined,
    clear: function () {
      for (var i = 0, il = buttons.els.length; i < il; i++) {
        list.utils.classes(buttons.els[i]).remove('asc')
        list.utils.classes(buttons.els[i]).remove('desc')
      }
    },
    getOrder: function (btn) {
      var predefinedOrder = list.utils.getAttribute(btn, 'data-order')
      if (predefinedOrder == 'asc' || predefinedOrder == 'desc') {
        return predefinedOrder
      } else if (list.utils.classes(btn).has('desc')) {
        return 'asc'
      } else if (list.utils.classes(btn).has('asc')) {
        return 'desc'
      } else {
        return 'asc'
      }
    },
    getInSensitive: function (btn, options) {
      var insensitive = list.utils.getAttribute(btn, 'data-insensitive')
      if (insensitive === 'false') {
        options.insensitive = false
      } else {
        options.insensitive = true
      }
    },
    setOrder: function (options) {
      for (var i = 0, il = buttons.els.length; i < il; i++) {
        var btn = buttons.els[i]
        if (list.utils.getAttribute(btn, 'data-sort') !== options.valueName) {
          continue
        }
        var predefinedOrder = list.utils.getAttribute(btn, 'data-order')
        if (predefinedOrder == 'asc' || predefinedOrder == 'desc') {
          if (predefinedOrder == options.order) {
            list.utils.classes(btn).add(options.order)
          }
        } else {
          list.utils.classes(btn).add(options.order)
        }
      }
    },
  }

  var sort = function () {
    list.trigger('sortStart')
    var options = {}

    var target = arguments[0].currentTarget || arguments[0].srcElement || undefined

    if (target) {
      options.valueName = list.utils.getAttribute(target, 'data-sort')
      buttons.getInSensitive(target, options)
      options.order = buttons.getOrder(target)
    } else {
      options = arguments[1] || options
      options.valueName = arguments[0]
      options.order = options.order || 'asc'
      options.insensitive = typeof options.insensitive == 'undefined' ? true : options.insensitive
    }

    buttons.clear()
    buttons.setOrder(options)

    // caseInsensitive
    // alphabet
    var customSortFunction = options.sortFunction || list.sortFunction || null,
      multi = options.order === 'desc' ? -1 : 1,
      sortFunction

    if (customSortFunction) {
      sortFunction = function (itemA, itemB) {
        return customSortFunction(itemA, itemB, options) * multi
      }
    } else {
      sortFunction = function (itemA, itemB) {
        var sort = list.utils.naturalSort
        sort.alphabet = list.alphabet || options.alphabet || undefined
        if (!sort.alphabet && options.insensitive) {
          sort = list.utils.naturalSort.caseInsensitive
        }
        return sort(itemA.values()[options.valueName], itemB.values()[options.valueName]) * multi
      }
    }

    list.items.sort(sortFunction)
    list.update()
    list.trigger('sortComplete')
  }

  // Add handlers
  list.handlers.sortStart = list.handlers.sortStart || []
  list.handlers.sortComplete = list.handlers.sortComplete || []

  buttons.els = list.utils.getByClass(list.listContainer, list.sortClass)
  list.utils.events.bind(buttons.els, 'click', sort)
  list.on('searchStart', buttons.clear)
  list.on('filterStart', buttons.clear)

  return sort
}

},{}],13:[function(require,module,exports){
var Templater = function (list) {
  var createItem,
    templater = this

  var init = function () {
    var itemSource

    if (typeof list.item === 'function') {
      createItem = function (values) {
        var item = list.item(values)
        return getItemSource(item)
      }
      return
    }

    if (typeof list.item === 'string') {
      if (list.item.indexOf('<') === -1) {
        itemSource = document.getElementById(list.item)
      } else {
        itemSource = getItemSource(list.item)
      }
    } else {
      /* If item source does not exists, use the first item in list as
      source for new items */
      itemSource = getFirstListItem()
    }

    if (!itemSource) {
      throw new Error("The list needs to have at least one item on init otherwise you'll have to add a template.")
    }

    itemSource = createCleanTemplateItem(itemSource, list.valueNames)

    createItem = function () {
      return itemSource.cloneNode(true)
    }
  }

  var createCleanTemplateItem = function (templateNode, valueNames) {
    var el = templateNode.cloneNode(true)
    el.removeAttribute('id')

    for (var i = 0, il = valueNames.length; i < il; i++) {
      var elm = undefined,
        valueName = valueNames[i]
      if (valueName.data) {
        for (var j = 0, jl = valueName.data.length; j < jl; j++) {
          el.setAttribute('data-' + valueName.data[j], '')
        }
      } else if (valueName.attr && valueName.name) {
        elm = list.utils.getByClass(el, valueName.name, true)
        if (elm) {
          elm.setAttribute(valueName.attr, '')
        }
      } else {
        elm = list.utils.getByClass(el, valueName, true)
        if (elm) {
          elm.innerHTML = ''
        }
      }
    }
    return el
  }

  var getFirstListItem = function () {
    var nodes = list.list.childNodes

    for (var i = 0, il = nodes.length; i < il; i++) {
      // Only textnodes have a data attribute
      if (nodes[i].data === undefined) {
        return nodes[i].cloneNode(true)
      }
    }
    return undefined
  }

  var getItemSource = function (itemHTML) {
    if (typeof itemHTML !== 'string') return undefined
    if (/<tr[\s>]/g.exec(itemHTML)) {
      var tbody = document.createElement('tbody')
      tbody.innerHTML = itemHTML
      return tbody.firstElementChild
    } else if (itemHTML.indexOf('<') !== -1) {
      var div = document.createElement('div')
      div.innerHTML = itemHTML
      return div.firstElementChild
    }
    return undefined
  }

  var getValueName = function (name) {
    for (var i = 0, il = list.valueNames.length; i < il; i++) {
      var valueName = list.valueNames[i]
      if (valueName.data) {
        var data = valueName.data
        for (var j = 0, jl = data.length; j < jl; j++) {
          if (data[j] === name) {
            return { data: name }
          }
        }
      } else if (valueName.attr && valueName.name && valueName.name == name) {
        return valueName
      } else if (valueName === name) {
        return name
      }
    }
  }

  var setValue = function (item, name, value) {
    var elm = undefined,
      valueName = getValueName(name)
    if (!valueName) return
    if (valueName.data) {
      item.elm.setAttribute('data-' + valueName.data, value)
    } else if (valueName.attr && valueName.name) {
      elm = list.utils.getByClass(item.elm, valueName.name, true)
      if (elm) {
        elm.setAttribute(valueName.attr, value)
      }
    } else {
      elm = list.utils.getByClass(item.elm, valueName, true)
      if (elm) {
        elm.innerHTML = value
      }
    }
  }

  this.get = function (item, valueNames) {
    templater.create(item)
    var values = {}
    for (var i = 0, il = valueNames.length; i < il; i++) {
      var elm = undefined,
        valueName = valueNames[i]
      if (valueName.data) {
        for (var j = 0, jl = valueName.data.length; j < jl; j++) {
          values[valueName.data[j]] = list.utils.getAttribute(item.elm, 'data-' + valueName.data[j])
        }
      } else if (valueName.attr && valueName.name) {
        elm = list.utils.getByClass(item.elm, valueName.name, true)
        values[valueName.name] = elm ? list.utils.getAttribute(elm, valueName.attr) : ''
      } else {
        elm = list.utils.getByClass(item.elm, valueName, true)
        values[valueName] = elm ? elm.innerHTML : ''
      }
    }
    return values
  }

  this.set = function (item, values) {
    if (!templater.create(item)) {
      for (var v in values) {
        if (values.hasOwnProperty(v)) {
          setValue(item, v, values[v])
        }
      }
    }
  }

  this.create = function (item) {
    if (item.elm !== undefined) {
      return false
    }
    item.elm = createItem(item.values())
    templater.set(item, item.values())
    return true
  }
  this.remove = function (item) {
    if (item.elm.parentNode === list.list) {
      list.list.removeChild(item.elm)
    }
  }
  this.show = function (item) {
    templater.create(item)
    list.list.appendChild(item.elm)
  }
  this.hide = function (item) {
    if (item.elm !== undefined && item.elm.parentNode === list.list) {
      list.list.removeChild(item.elm)
    }
  }
  this.clear = function () {
    /* .innerHTML = ''; fucks up IE */
    if (list.list.hasChildNodes()) {
      while (list.list.childNodes.length >= 1) {
        list.list.removeChild(list.list.firstChild)
      }
    }
  }

  init()
}

module.exports = function (list) {
  return new Templater(list)
}

},{}],14:[function(require,module,exports){
/**
 * Module dependencies.
 */

var index = require('./index-of')

/**
 * Whitespace regexp.
 */

var re = /\s+/

/**
 * toString reference.
 */

var toString = Object.prototype.toString

/**
 * Wrap `el` in a `ClassList`.
 *
 * @param {Element} el
 * @return {ClassList}
 * @api public
 */

module.exports = function (el) {
  return new ClassList(el)
}

/**
 * Initialize a new ClassList for `el`.
 *
 * @param {Element} el
 * @api private
 */

function ClassList(el) {
  if (!el || !el.nodeType) {
    throw new Error('A DOM element reference is required')
  }
  this.el = el
  this.list = el.classList
}

/**
 * Add class `name` if not already present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.add = function (name) {
  // classList
  if (this.list) {
    this.list.add(name)
    return this
  }

  // fallback
  var arr = this.array()
  var i = index(arr, name)
  if (!~i) arr.push(name)
  this.el.className = arr.join(' ')
  return this
}

/**
 * Remove class `name` when present, or
 * pass a regular expression to remove
 * any which match.
 *
 * @param {String|RegExp} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.remove = function (name) {
  // classList
  if (this.list) {
    this.list.remove(name)
    return this
  }

  // fallback
  var arr = this.array()
  var i = index(arr, name)
  if (~i) arr.splice(i, 1)
  this.el.className = arr.join(' ')
  return this
}

/**
 * Toggle class `name`, can force state via `force`.
 *
 * For browsers that support classList, but do not support `force` yet,
 * the mistake will be detected and corrected.
 *
 * @param {String} name
 * @param {Boolean} force
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.toggle = function (name, force) {
  // classList
  if (this.list) {
    if ('undefined' !== typeof force) {
      if (force !== this.list.toggle(name, force)) {
        this.list.toggle(name) // toggle again to correct
      }
    } else {
      this.list.toggle(name)
    }
    return this
  }

  // fallback
  if ('undefined' !== typeof force) {
    if (!force) {
      this.remove(name)
    } else {
      this.add(name)
    }
  } else {
    if (this.has(name)) {
      this.remove(name)
    } else {
      this.add(name)
    }
  }

  return this
}

/**
 * Return an array of classes.
 *
 * @return {Array}
 * @api public
 */

ClassList.prototype.array = function () {
  var className = this.el.getAttribute('class') || ''
  var str = className.replace(/^\s+|\s+$/g, '')
  var arr = str.split(re)
  if ('' === arr[0]) arr.shift()
  return arr
}

/**
 * Check if class `name` is present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.has = ClassList.prototype.contains = function (name) {
  return this.list ? this.list.contains(name) : !!~index(this.array(), name)
}

},{"./index-of":20}],15:[function(require,module,exports){
var bind = window.addEventListener ? 'addEventListener' : 'attachEvent',
  unbind = window.removeEventListener ? 'removeEventListener' : 'detachEvent',
  prefix = bind !== 'addEventListener' ? 'on' : '',
  toArray = require('./to-array')

/**
 * Bind `el` event `type` to `fn`.
 *
 * @param {Element} el, NodeList, HTMLCollection or Array
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @api public
 */

exports.bind = function (el, type, fn, capture) {
  el = toArray(el)
  for (var i = 0, il = el.length; i < il; i++) {
    el[i][bind](prefix + type, fn, capture || false)
  }
}

/**
 * Unbind `el` event `type`'s callback `fn`.
 *
 * @param {Element} el, NodeList, HTMLCollection or Array
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @api public
 */

exports.unbind = function (el, type, fn, capture) {
  el = toArray(el)
  for (var i = 0, il = el.length; i < il; i++) {
    el[i][unbind](prefix + type, fn, capture || false)
  }
}

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * `wait` milliseconds. If `immediate` is true, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * @param {Function} fn
 * @param {Integer} wait
 * @param {Boolean} immediate
 * @api public
 */

exports.debounce = function (fn, wait, immediate) {
  var timeout
  return wait
    ? function () {
        var context = this,
          args = arguments
        var later = function () {
          timeout = null
          if (!immediate) fn.apply(context, args)
        }
        var callNow = immediate && !timeout
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
        if (callNow) fn.apply(context, args)
      }
    : fn
}

},{"./to-array":21}],16:[function(require,module,exports){
/*
 * Source: https://github.com/segmentio/extend
 */

module.exports = function extend(object) {
  // Takes an unlimited number of extenders.
  var args = Array.prototype.slice.call(arguments, 1)

  // For each extender, copy their properties on our object.
  for (var i = 0, source; (source = args[i]); i++) {
    if (!source) continue
    for (var property in source) {
      object[property] = source[property]
    }
  }

  return object
}

},{}],17:[function(require,module,exports){
module.exports = function (text, pattern, options) {
  // Aproximately where in the text is the pattern expected to be found?
  var Match_Location = options.location || 0

  //Determines how close the match must be to the fuzzy location (specified above). An exact letter match which is 'distance' characters away from the fuzzy location would score as a complete mismatch. A distance of '0' requires the match be at the exact location specified, a threshold of '1000' would require a perfect match to be within 800 characters of the fuzzy location to be found using a 0.8 threshold.
  var Match_Distance = options.distance || 100

  // At what point does the match algorithm give up. A threshold of '0.0' requires a perfect match (of both letters and location), a threshold of '1.0' would match anything.
  var Match_Threshold = options.threshold || 0.4

  if (pattern === text) return true // Exact match
  if (pattern.length > 32) return false // This algorithm cannot be used

  // Set starting location at beginning text and initialise the alphabet.
  var loc = Match_Location,
    s = (function () {
      var q = {},
        i

      for (i = 0; i < pattern.length; i++) {
        q[pattern.charAt(i)] = 0
      }

      for (i = 0; i < pattern.length; i++) {
        q[pattern.charAt(i)] |= 1 << (pattern.length - i - 1)
      }

      return q
    })()

  // Compute and return the score for a match with e errors and x location.
  // Accesses loc and pattern through being a closure.

  function match_bitapScore_(e, x) {
    var accuracy = e / pattern.length,
      proximity = Math.abs(loc - x)

    if (!Match_Distance) {
      // Dodge divide by zero error.
      return proximity ? 1.0 : accuracy
    }
    return accuracy + proximity / Match_Distance
  }

  var score_threshold = Match_Threshold, // Highest score beyond which we give up.
    best_loc = text.indexOf(pattern, loc) // Is there a nearby exact match? (speedup)

  if (best_loc != -1) {
    score_threshold = Math.min(match_bitapScore_(0, best_loc), score_threshold)
    // What about in the other direction? (speedup)
    best_loc = text.lastIndexOf(pattern, loc + pattern.length)

    if (best_loc != -1) {
      score_threshold = Math.min(match_bitapScore_(0, best_loc), score_threshold)
    }
  }

  // Initialise the bit arrays.
  var matchmask = 1 << (pattern.length - 1)
  best_loc = -1

  var bin_min, bin_mid
  var bin_max = pattern.length + text.length
  var last_rd
  for (var d = 0; d < pattern.length; d++) {
    // Scan for the best match; each iteration allows for one more error.
    // Run a binary search to determine how far from 'loc' we can stray at this
    // error level.
    bin_min = 0
    bin_mid = bin_max
    while (bin_min < bin_mid) {
      if (match_bitapScore_(d, loc + bin_mid) <= score_threshold) {
        bin_min = bin_mid
      } else {
        bin_max = bin_mid
      }
      bin_mid = Math.floor((bin_max - bin_min) / 2 + bin_min)
    }
    // Use the result from this iteration as the maximum for the next.
    bin_max = bin_mid
    var start = Math.max(1, loc - bin_mid + 1)
    var finish = Math.min(loc + bin_mid, text.length) + pattern.length

    var rd = Array(finish + 2)
    rd[finish + 1] = (1 << d) - 1
    for (var j = finish; j >= start; j--) {
      // The alphabet (s) is a sparse hash, so the following line generates
      // warnings.
      var charMatch = s[text.charAt(j - 1)]
      if (d === 0) {
        // First pass: exact match.
        rd[j] = ((rd[j + 1] << 1) | 1) & charMatch
      } else {
        // Subsequent passes: fuzzy match.
        rd[j] = (((rd[j + 1] << 1) | 1) & charMatch) | (((last_rd[j + 1] | last_rd[j]) << 1) | 1) | last_rd[j + 1]
      }
      if (rd[j] & matchmask) {
        var score = match_bitapScore_(d, j - 1)
        // This match will almost certainly be better than any existing match.
        // But check anyway.
        if (score <= score_threshold) {
          // Told you so.
          score_threshold = score
          best_loc = j - 1
          if (best_loc > loc) {
            // When passing loc, don't exceed our current distance from loc.
            start = Math.max(1, 2 * loc - best_loc)
          } else {
            // Already passed loc, downhill from here on in.
            break
          }
        }
      }
    }
    // No hope for a (better) match at greater error levels.
    if (match_bitapScore_(d + 1, loc) > score_threshold) {
      break
    }
    last_rd = rd
  }

  return best_loc < 0 ? false : true
}

},{}],18:[function(require,module,exports){
/**
 * A cross-browser implementation of getAttribute.
 * Source found here: http://stackoverflow.com/a/3755343/361337 written by Vivin Paliath
 *
 * Return the value for `attr` at `element`.
 *
 * @param {Element} el
 * @param {String} attr
 * @api public
 */

module.exports = function (el, attr) {
  var result = (el.getAttribute && el.getAttribute(attr)) || null
  if (!result) {
    var attrs = el.attributes
    var length = attrs.length
    for (var i = 0; i < length; i++) {
      if (attrs[i] !== undefined) {
        if (attrs[i].nodeName === attr) {
          result = attrs[i].nodeValue
        }
      }
    }
  }
  return result
}

},{}],19:[function(require,module,exports){
/**
 * A cross-browser implementation of getElementsByClass.
 * Heavily based on Dustin Diaz's function: http://dustindiaz.com/getelementsbyclass.
 *
 * Find all elements with class `className` inside `container`.
 * Use `single = true` to increase performance in older browsers
 * when only one element is needed.
 *
 * @param {String} className
 * @param {Element} container
 * @param {Boolean} single
 * @api public
 */

var getElementsByClassName = function (container, className, single) {
  if (single) {
    return container.getElementsByClassName(className)[0]
  } else {
    return container.getElementsByClassName(className)
  }
}

var querySelector = function (container, className, single) {
  className = '.' + className
  if (single) {
    return container.querySelector(className)
  } else {
    return container.querySelectorAll(className)
  }
}

var polyfill = function (container, className, single) {
  var classElements = [],
    tag = '*'

  var els = container.getElementsByTagName(tag)
  var elsLen = els.length
  var pattern = new RegExp('(^|\\s)' + className + '(\\s|$)')
  for (var i = 0, j = 0; i < elsLen; i++) {
    if (pattern.test(els[i].className)) {
      if (single) {
        return els[i]
      } else {
        classElements[j] = els[i]
        j++
      }
    }
  }
  return classElements
}

module.exports = (function () {
  return function (container, className, single, options) {
    options = options || {}
    if ((options.test && options.getElementsByClassName) || (!options.test && document.getElementsByClassName)) {
      return getElementsByClassName(container, className, single)
    } else if ((options.test && options.querySelector) || (!options.test && document.querySelector)) {
      return querySelector(container, className, single)
    } else {
      return polyfill(container, className, single)
    }
  }
})()

},{}],20:[function(require,module,exports){
var indexOf = [].indexOf

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0, il = arr.length; i < il; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1
}

},{}],21:[function(require,module,exports){
/**
 * Source: https://github.com/timoxley/to-array
 *
 * Convert an array-like object into an `Array`.
 * If `collection` is already an `Array`, then will return a clone of `collection`.
 *
 * @param {Array | Mixed} collection An `Array` or array-like object to convert e.g. `arguments` or `NodeList`
 * @return {Array} Naive conversion of `collection` to a new `Array`.
 * @api public
 */

module.exports = function toArray(collection) {
  if (typeof collection === 'undefined') return []
  if (collection === null) return [null]
  if (collection === window) return [window]
  if (typeof collection === 'string') return [collection]
  if (isArray(collection)) return collection
  if (typeof collection.length != 'number') return [collection]
  if (typeof collection === 'function' && collection instanceof Function) return [collection]

  var arr = [];
  for (var i = 0, il = collection.length; i < il; i++) {
    if (Object.prototype.hasOwnProperty.call(collection, i) || i in collection) {
      arr.push(collection[i])
    }
  }
  if (!arr.length) return []
  return arr
}

function isArray(arr) {
  return Object.prototype.toString.call(arr) === '[object Array]'
}

},{}],22:[function(require,module,exports){
module.exports = function (s) {
  s = s === undefined ? '' : s
  s = s === null ? '' : s
  s = s.toString()
  return s
}

},{}],23:[function(require,module,exports){
'use strict';

var alphabet;
var alphabetIndexMap;
var alphabetIndexMapLength = 0;

function isNumberCode(code) {
  return code >= 48 && code <= 57;
}

function naturalCompare(a, b) {
  var lengthA = (a += '').length;
  var lengthB = (b += '').length;
  var aIndex = 0;
  var bIndex = 0;

  while (aIndex < lengthA && bIndex < lengthB) {
    var charCodeA = a.charCodeAt(aIndex);
    var charCodeB = b.charCodeAt(bIndex);

    if (isNumberCode(charCodeA)) {
      if (!isNumberCode(charCodeB)) {
        return charCodeA - charCodeB;
      }

      var numStartA = aIndex;
      var numStartB = bIndex;

      while (charCodeA === 48 && ++numStartA < lengthA) {
        charCodeA = a.charCodeAt(numStartA);
      }
      while (charCodeB === 48 && ++numStartB < lengthB) {
        charCodeB = b.charCodeAt(numStartB);
      }

      var numEndA = numStartA;
      var numEndB = numStartB;

      while (numEndA < lengthA && isNumberCode(a.charCodeAt(numEndA))) {
        ++numEndA;
      }
      while (numEndB < lengthB && isNumberCode(b.charCodeAt(numEndB))) {
        ++numEndB;
      }

      var difference = numEndA - numStartA - numEndB + numStartB; // numA length - numB length
      if (difference) {
        return difference;
      }

      while (numStartA < numEndA) {
        difference = a.charCodeAt(numStartA++) - b.charCodeAt(numStartB++);
        if (difference) {
          return difference;
        }
      }

      aIndex = numEndA;
      bIndex = numEndB;
      continue;
    }

    if (charCodeA !== charCodeB) {
      if (
        charCodeA < alphabetIndexMapLength &&
        charCodeB < alphabetIndexMapLength &&
        alphabetIndexMap[charCodeA] !== -1 &&
        alphabetIndexMap[charCodeB] !== -1
      ) {
        return alphabetIndexMap[charCodeA] - alphabetIndexMap[charCodeB];
      }

      return charCodeA - charCodeB;
    }

    ++aIndex;
    ++bIndex;
  }

  if (aIndex >= lengthA && bIndex < lengthB && lengthA >= lengthB) {
    return -1;
  }

  if (bIndex >= lengthB && aIndex < lengthA && lengthB >= lengthA) {
    return 1;
  }

  return lengthA - lengthB;
}

naturalCompare.caseInsensitive = naturalCompare.i = function(a, b) {
  return naturalCompare(('' + a).toLowerCase(), ('' + b).toLowerCase());
};

Object.defineProperties(naturalCompare, {
  alphabet: {
    get: function() {
      return alphabet;
    },

    set: function(value) {
      alphabet = value;
      alphabetIndexMap = [];

      var i = 0;

      if (alphabet) {
        for (; i < alphabet.length; i++) {
          alphabetIndexMap[alphabet.charCodeAt(i)] = i;
        }
      }

      alphabetIndexMapLength = alphabetIndexMap.length;

      for (i = 0; i < alphabetIndexMapLength; i++) {
        if (alphabetIndexMap[i] === undefined) {
          alphabetIndexMap[i] = -1;
        }
      }
    },
  },
});

module.exports = naturalCompare;

},{}],24:[function(require,module,exports){
const createListStructure = () => {
    let listHTML = document.createElement("ul");
    listHTML.classList.add("list");

    document.getElementById("ly_event_plugin").appendChild(listHTML);
}

module.exports = {
    createListStructure: createListStructure
}
},{}],25:[function(require,module,exports){
var LineClamp = require("@tvanc/lineclamp");

const buildModal = () => {
    let modal = document.createElement("div");
    modal.id = "ly_description_modal";
    modal.classList.add("hidden", "fixed");

    document.body.appendChild(modal);
}

const destroyModal = () => {
    document.getElementById("ly_description_modal").remove();
    buildModal();
}

const showModal = (data) => {
    let modal = document.getElementById("ly_description_modal");
    modal.classList.remove("hidden");
    
    let description = document.createElement("p");
    description.innerHTML = data;
    description.id = "ly_event_description_1"

    let does_desc_exist = document.getElementById("ly_event_description_1");


    let closeButton = document.createElement("button");
    closeButton.innerHTML = "&times; close";
    closeButton.classList.add("w-full", "cursor-pointer", "text-xl", "text-center", "shadow", "p-2", "mt-4", "mb-4");

    closeButton.addEventListener("click", () => {
        destroyModal();
    });

    //check if the modal content already exists. Stops "double click" on "read more..."
    if(does_desc_exist === null){
        modal.appendChild(description);
        modal.appendChild(closeButton);
    }

}

const clampDescriptions = () => {
    const elements = document.querySelectorAll(".description");

    elements.forEach((element) => {
        let textToBeClamped = element.innerHTML;

        const clamp = new LineClamp(element, { maxLines: 2 });

        if(clamp.shouldClamp() === true){

            //insert "read more"
            let readMore = document.createElement("span");
            readMore.innerHTML = "read more";
            readMore.classList.add("font-extralight", "cursor-pointer", "ly_desc_readmore");
            readMore.addEventListener("click",(e) => {
                showModal(textToBeClamped);
            });

            element.parentNode.appendChild(readMore);

            clamp.apply();
        }
    });
}

module.exports = {
    buildModal: buildModal,
    destroyModal: destroyModal,
    clampDescriptions: clampDescriptions
    // showModal: showModal
}
},{"@tvanc/lineclamp":1}],26:[function(require,module,exports){
const no_events = (logoSrc) => {
    let no_events = document.createElement("div");
    let more_coming = document.createElement("span");
    more_coming.innerHTML = "More Events Coming Soon!";
    more_coming.style.textAlign = "center";
    more_coming.classList.add("text-lg");

    let logo = document.createElement("img");
    logo.src = logoSrc;

    logo.classList.add('w-1/6', 'pt-8');

    no_events.appendChild(logo);
    no_events.appendChild(more_coming);

    no_events.classList.add("flex", "flex-col", "items-center", "justify-center");

    document.getElementById("ly_event_plugin").appendChild(no_events);
}

module.exports = {
    renderNoEvents: no_events
}
},{}],27:[function(require,module,exports){
const getRibbonData = async (hostId, token) => {
    const ribbonRes = fetch(`https://api.withribbon.com/api/v1/Events?hostId=${hostId}&token=${token}`)
    .then(response => response.json())
    .then(data => { return data } )
    .catch((err) => console.log(err));

    return ribbonRes;
}

module.exports = {
    getRibbonData: getRibbonData
}
},{}],28:[function(require,module,exports){
var dayjs = require("dayjs");

const getUniqueDates = (e) => {
    let allDates = e.map((x) => ({date: dayjs(x.dateTime).format("YYYY-MM-DD")}));
    let uniqDates = new Set(allDates);

    return Array.from(uniqDates);
}

const handleResetButtonReset = (flag) => {
    let reset_button = document.getElementById("ly_plugin_reset_button");

    if(flag === 1){
        reset_button.innerHTML = "Showing All Events";
        reset_button.disabled = true;
        reset_button.classList.add("opacity-50", "cursor-not-allowed");
    } else if(flag === 2){
        reset_button.innerHTML = "Clear Filters";
        reset_button.disabled = false;
        reset_button.classList.remove("opacity-50", "cursor-not-allowed");
    }
}

module.exports = {
    getUniqueDates: getUniqueDates,
    handleResetButtonReset: handleResetButtonReset,
}
},{"dayjs":2}],29:[function(require,module,exports){
//dayjs
var dayjs = require("dayjs");
var customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
//vendor modules
var vanillaCalendar = require('./vendor/vanilla-calendar');
var List = require('list.js');
//custom components
let { getRibbonData } = require('./components/ribbonapi');
var modal = require('./components/modal.js');
var utils = require('./components/utils');
var no_events = require('./components/noEvents.js');
var lc = require('./components/list');

/*
set list options and build item templates
*/

let listOptions = {
    valueNames: [ "id", "title", "date", "time", "teacher", "duration", {data: {name: "link", attr: "href"}}, "description", "sort", "month", "img1"],
    item: function(values) {
        //dates are formatted without special characters because it breaks List.js sort
        return `<li class="shadow p-6 relative mt-4" id="${values.id}">
                    <div>
                        <img src="${values.img1}" alt="class image for ${values.title}" height="100px" width="100px">
                    </div>
                    <div class="absolute top-6 left-36">
                        <span>${dayjs(values.date, "YYYYMMDD").format("dddd D MMM YYYY")} at ${values.time}</span>
                        <h1 class="title text-xl mt-1"></h1>
                    </div>
                    <div class="text-right absolute top-6 right-6 ly_teacher_duration font-light">
                        <span>Taught by: </span><span class="teacher"></span><br>
                        <span class="duration"></span><span> Minutes</span>
                    </div>
                    <span class="date hidden"></span>
                    <div class="max-w-md mt-8">
                        <span class="description"></span>
                    </div>
                    <a style="background-color: var(--vanilla-calendar-selected-bg-color); color: white; font-weight: 300 !important" class="hover:shadow-lg transition-shadow absolute bottom-6 right-6 p-2 pr-4 pl-4 ly_signup_button" href="${values.link}">Sign Up</a>
                </li>`;
    }
}

//global variables for list and calendar
let lyEventList, lyCalendar, ribbonData;

//Ribbon API id & token
let scriptRootTag = document.getElementById("ly_ribbon_widget_srt");
let hostId = scriptRootTag.getAttribute("hostId"), 
// let hostId = "2916", token = "7e60c8022c",
    token = scriptRootTag.getAttribute("token"),
    logoSrc = scriptRootTag.getAttribute("logoSrc");


//promise to return data from Ribbon API
const initRibbon = async (h,k) => {
    let ribbonData = await getRibbonData(h,k);

    //return API data, but only return events that are after today
    return ribbonData.filter((e) => dayjs(e.dateTime).isAfter(dayjs()));
}

/*
reset button functionality
*/

const buildFilterContainer = () => {
    let filterContainer = document.createElement("div");
    filterContainer.classList.add("flex-row");
    filterContainer.id = "ly_filter_container";

    return filterContainer;
}

const buildFilters = (data) => {
    let el = document.getElementById("ly_event_plugin");
    let filterContainer = buildFilterContainer();

    //add reset button to filter container
    filterContainer.appendChild(createResetButton());

    //create teacher filter
    // createTeacherFilter(data, filterContainer);

    //append to plugin container
    el.prepend(filterContainer);
}

const createResetButton = () => {
    let resetButton = document.createElement("button");
    resetButton.id = "ly_plugin_reset_button";
    resetButton.innerHTML = "Showing All Events";
    resetButton.disabled = true;
    resetButton.classList.add("shadow", "p-2", "pr-4", "pl-4", "m-4", "opacity-50", "cursor-not-allowed");

    resetButton.addEventListener("click", () => handleFilterClear());

    return resetButton;
}

const handleFilterClear = () => {
    lyEventList.search();
    lyCalendar.reset();

    utils.handleResetButtonReset(1);
}

/*
calendar functionality
*/

const createCalStructure = () => {
    let calHTML = document.createElement("div");
    calHTML.id = "ly_event_cal";
    calHTML.classList.add("vanilla-calendar");

    document.getElementById("ly_event_plugin").prepend(calHTML);
}

const handleDateSelection = (data) => {
    //dates are formatted without special characters because it breaks List.js sort
    let searchDate = dayjs(data.data.date).format("YYYYMMDD");

    lyEventList.search(searchDate, 'searchDate');

    utils.handleResetButtonReset(2);
}

const buildCalendar = (events) => {
    lyCalendar = new VanillaCalendar({
        selector: "#ly_event_cal",
        datesFilter: true,
        availableDates: utils.getUniqueDates(events),
        onSelect: (data) => {
            handleDateSelection(data)
        }
    });
}

/*
init functions
*/

//create list & modal elements
lc.createListStructure();
modal.buildModal();

//get data from ribbon
initRibbon(hostId,token).then((data) => {
    let newData = data.map((d) => {
        //creates custom format so List.js can search by date on calendar events
        let searchDate = dayjs(d.dateTime).format("YYYYMMDD").toString();

        console.log(d.image1)
        
        return ({   id: d.id,
                    title: d.title, 
                    date: searchDate, 
                    time: dayjs(d.dateTime).format("hh:mm A"),
                    sort: d.dateTime,
                    teacher: d.teacher, 
                    duration: d.duration,
                    link: d.link,
                    description: d.description,
                    img1: d.image1 === null ? logoSrc : d.image1
                });

    })
    //creates the List.js list
    lyEventList = new List('ly_event_plugin', listOptions, newData);

    //sorts based on DayJS dateTime objects
    lyEventList.sort('sort', {sortFunction: (a,b) => {
        if(dayjs(a.values().sort).isBefore(dayjs(b.values().sort))) return -1;
        else return 1;
    }});

    //line clamp long descriptions and implement a "read more button"
    modal.clampDescriptions();

    return data
}).then((data) => {
    if(data.length > 0){
        // get 'showcalendar' attribute
        let showCalendar = document.getElementById("ly_ribbon_widget_srt").getAttribute('showcalendar') || true;

        //no need to build the calendar if it's not going to be shown.
        if(showCalendar === true){
            buildFilters(data);
            createCalStructure();
            buildCalendar(data);
        }
    } else {
        no_events.renderNoEvents(logoSrc);
    }
});
},{"./components/list":24,"./components/modal.js":25,"./components/noEvents.js":26,"./components/ribbonapi":27,"./components/utils":28,"./vendor/vanilla-calendar":30,"dayjs":2,"dayjs/plugin/customParseFormat":3,"list.js":7}],30:[function(require,module,exports){
/*
    Vanilla AutoComplete v0.1
    Copyright (c) 2019 Mauro Marssola
    GitHub: https://github.com/marssola/vanilla-calendar
    License: http://www.opensource.org/licenses/mit-license.php
*/
let VanillaCalendar = (function () {
    function VanillaCalendar(options) {
        function addEvent(el, type, handler){
            if (!el) return
            if (el.attachEvent) el.attachEvent('on' + type, handler)
            else el.addEventListener(type, handler);
        }
        function removeEvent(el, type, handler){
            if (!el) return
            if (el.detachEvent) el.detachEvent('on' + type, handler)
            else el.removeEventListener(type, handler);
        }
        let opts = {
            selector: null,
            datesFilter: false,
            pastDates: true,
            availableWeekDays: [],
            availableDates: [],
            date: new Date(),
            todaysDate: new Date(),
            button_prev: null,
            button_next: null,
            month: null,
            month_label: null,
            onSelect: (data, elem) => {},
            onMonth: (data, elem) => {},
            months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            shortWeekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        }
        for (let k in options) if (opts.hasOwnProperty(k)) opts[k] = options[k]
        
        let element = document.querySelector(opts.selector)
        if (!element)
            return
        
        const getWeekDay = function (day) {
            return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][day]
        }
        
        const createDay = function (date) {
            let newDayElem = document.createElement('div')
            let dateElem = document.createElement('span')
            dateElem.innerHTML = date.getDate()
            newDayElem.className = 'vanilla-calendar-date'
            newDayElem.setAttribute('data-calendar-date', date)
            
            let available_week_day = opts.availableWeekDays.filter(f => f.day === date.getDay() || f.day === getWeekDay(date.getDay()))
            let available_date = opts.availableDates.filter(f => f.date === (date.getFullYear() + '-' + String(date.getMonth() + 1).padStart('2', 0) + '-' + String(date.getDate()).padStart('2', 0)))
            
            if (date.getDate() === 1) {
                newDayElem.style.marginLeft = ((date.getDay()) * 14.28) + '%'
            }
            if (opts.date.getTime() <= opts.todaysDate.getTime() - 1 && !opts.pastDates) {
                newDayElem.classList.add('vanilla-calendar-date--disabled')
            } else {
                if (opts.datesFilter) {
                    if (available_week_day.length) {
                        newDayElem.classList.add('vanilla-calendar-date--active')
                        newDayElem.setAttribute('data-calendar-data', JSON.stringify(available_week_day[0]))
                        newDayElem.setAttribute('data-calendar-status', 'active')
                    } else if (available_date.length) {
                        newDayElem.classList.add('vanilla-calendar-date--active')
                        newDayElem.setAttribute('data-calendar-data', JSON.stringify(available_date[0]))
                        newDayElem.setAttribute('data-calendar-status', 'active')
                    } else {
                        newDayElem.classList.add('vanilla-calendar-date--disabled')
                    }
                } else {
                    newDayElem.classList.add('vanilla-calendar-date--active')
                    newDayElem.setAttribute('data-calendar-status', 'active')
                }
            }
            if (date.toString() === opts.todaysDate.toString()) {
                newDayElem.classList.add('vanilla-calendar-date--today')
            }
            
            newDayElem.appendChild(dateElem)
            opts.month.appendChild(newDayElem)
        }
        
        const removeActiveClass = function () {
            document.querySelectorAll('.vanilla-calendar-date--selected').forEach(s => {
                s.classList.remove('vanilla-calendar-date--selected')
            })
        }
        
        const selectDate = function () {
            let activeDates = element.querySelectorAll('[data-calendar-status=active]')
            activeDates.forEach(date => {
                date.addEventListener('click', function () {
                    removeActiveClass()
                    let datas = this.dataset
                    let data = {}
                    if (datas.calendarDate)
                        data.date = datas.calendarDate
                    if (datas.calendarData)
                        data.data = JSON.parse(datas.calendarData)
                    opts.onSelect(data, this)
                    this.classList.add('vanilla-calendar-date--selected')
                })
            })
        }
        
        const createMonth = function () {
            clearCalendar()
            let currentMonth = opts.date.getMonth()
            while (opts.date.getMonth() === currentMonth) {
                createDay(opts.date)
                opts.date.setDate(opts.date.getDate() + 1)
            }

            opts.onMonth(currentMonth, this);
            
            opts.date.setDate(1)
            opts.date.setMonth(opts.date.getMonth() -1)
            opts.month_label.innerHTML = opts.months[opts.date.getMonth()] + ' ' + opts.date.getFullYear()
            selectDate()
        }
        
        const monthPrev = function () {
            opts.date.setMonth(opts.date.getMonth() - 1)
            createMonth()
        }
        
        const monthNext = function () {
            opts.date.setMonth(opts.date.getMonth() + 1)
            createMonth()
        }
        
        const clearCalendar = function () {
            opts.month.innerHTML = ''
        }
        
        const createCalendar = function () {
            document.querySelector(opts.selector).innerHTML = `
            <div class="vanilla-calendar-header">
                <button type="button" class="vanilla-calendar-btn" data-calendar-toggle="previous"><svg height="24" version="1.1" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"></path></svg></button>
                <div class="vanilla-calendar-header__label" data-calendar-label="month"></div>
                <button type="button" class="vanilla-calendar-btn" data-calendar-toggle="next"><svg height="24" version="1.1" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z"></path></svg></button>
            </div>
            <div class="vanilla-calendar-week"></div>
            <div class="vanilla-calendar-body" data-calendar-area="month"></div>
            `
        }
        const setWeekDayHeader = function () {
            document.querySelector(`${opts.selector} .vanilla-calendar-week`).innerHTML = `
                <span>${opts.shortWeekday[0]}</span>
                <span>${opts.shortWeekday[1]}</span>
                <span>${opts.shortWeekday[2]}</span>
                <span>${opts.shortWeekday[3]}</span>
                <span>${opts.shortWeekday[4]}</span>
                <span>${opts.shortWeekday[5]}</span>
                <span>${opts.shortWeekday[6]}</span>
            `
        }
        
        this.init = function () {
            createCalendar()
            opts.button_prev = document.querySelector(opts.selector + ' [data-calendar-toggle=previous]')
            opts.button_next = document.querySelector(opts.selector + ' [data-calendar-toggle=next]')
            opts.month = document.querySelector(opts.selector + ' [data-calendar-area=month]')
            opts.month_label = document.querySelector(opts.selector + ' [data-calendar-label=month]')
            
            opts.date.setDate(1)
            createMonth()
            setWeekDayHeader()
            addEvent(opts.button_prev, 'click', monthPrev)
            addEvent(opts.button_next, 'click', monthNext)
        }
        
        this.destroy = function () {
            removeEvent(opts.button_prev, 'click', monthPrev)
            removeEvent(opts.button_next, 'click', monthNext)
            clearCalendar()
            document.querySelector(opts.selector).innerHTML = ''
        }
        
        this.reset = function () {
            this.destroy()
            this.init()
        }
        
        this.set = function (options) {
            for (let k in options)
                if (opts.hasOwnProperty(k))
                    opts[k] = options[k]
            createMonth()
//             this.reset()
        }
        
        this.init()
    }
    return VanillaCalendar
})()

window.VanillaCalendar = VanillaCalendar

},{}]},{},[29])(29)
});
