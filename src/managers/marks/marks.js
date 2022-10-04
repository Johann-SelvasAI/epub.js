import svg from "./svg";
import events from "./events";
import EpubCFI from "../../epubcfi";


export class Pane {
    constructor(target, container = document.body) {
        this.target = target;
        this.element = svg.createElement("svg");
        this.marks = [];

        // Match the coordinates of the target element
        this.element.style.position = "absolute";
        // Disable pointer events
        this.element.setAttribute("pointer-events", "none");

        // Set up mouse event proxying between the target element and the marks
        events.proxyMouse(this.target, this.marks);

        this.container = container;
        this.container.appendChild(this.element);

        this.render();
    }

    addMark(mark) {
        var g = svg.createElement("g");
        this.element.appendChild(g);
        mark.bind(g, this.container);

        this.marks.push(mark);

        mark.render();
        return mark;
    }

    removeMark(mark) {
        var idx = this.marks.indexOf(mark);
        if (idx === -1) {
            return;
        }
        var el = mark.unbind();
        this.element.removeChild(el);
        this.marks.splice(idx, 1);
    }

    render() {
        setCoords(this.element, coords(this.target, this.container));
        for (var m of this.marks) {
            m.render();
        }
    }
}

export class Mark {
    constructor() {
        this.element = null;
    }

    bind(element, container) {
        this.element = element;
        this.container = container;
    }

    unbind() {
        var el = this.element;
        this.element = null;
        return el;
    }

    render() {}

    dispatchEvent(e) {
        if (!this.element) return;
        this.element.dispatchEvent(e);
    }

    getBoundingClientRect() {
        return this.element.getBoundingClientRect();
    }

    getClientRects() {
        var rects = [];
        var el = this.element.firstChild;
        while (el) {
            rects.push(el.getBoundingClientRect());
            el = el.nextSibling;
        }
        return rects;
    }

    convertJSON(obj) {
        var json = {
            top: obj.top,
            bottom: obj.bottom,
            left: obj.left,
            right: obj.right,
            height: obj.height,
            width: obj.width
        };

        if (obj.x) {
            json.x = obj.x;
        }

        if (obj.y) {
            json.y = obj.y;
        }

        return json;
    }

    filteredRanges() {
        const range = this.range();

        if (!range) {
            return [];
        }

        const rects = Array.from(range.getClientRects());
        return rects.map(r => convertJSON(r));
    }

	range(ignoreClass){
		var cfi = new EpubCFI(this.data['epubcfi']);
		return cfi.toRange(this.getDocument(), ignoreClass);
	}

    getRanges() {
        const doc = this.getDocument();

        if (!doc) {
            return [];
        }

        var prevId = -1;
        var obj = {};
        var rects = [];
        const filtered = this.filteredRanges();

        if (!filtered || filtered.length === 0) {
            return [];
        }

        for (var i = 0; i < filtered.length; i++) {
            var r = filtered[i];
            var element = doc.elementFromPoint(r.left, r.top);

            if (element) {
                var id = parseInt(element.getAttribute('data-index'));
                var text = element.textContent;

                if (text.trim().length === 0) {
                    continue;
                }

                if (id !== prevId) {
                    var span = doc.createElement("span");
                    span.innerText = text;
                    element.innerHTML = "";
                    element.appendChild(span);
                    obj[id] = {
                        old: [r],
                        new: Array.from(span.getClientRects()).map(r => convertJSON(r))
                    };
                    element.innerHTML = text;
                    prevId = id;
                    prevId = id;
                } else {
                    obj[id].old.push(r);
                }
            }
        }

        const keys = Object.keys(obj);

        for (var i = 0; i < keys.length; i++) {
            var key = parseInt(keys[i]);
            rects = rects.concat(i === 0 || i === keys.length - 1 ? obj[key].old : obj[key].new);
        }

        const stringRects = rects.map(r => JSON.stringify(r));
        const setRects = new Set(stringRects);
        return Array.from(setRects).map(sr => JSON.parse(sr));
    }

    getDocument() {
        var iframe = this.container.querySelector("iframe");

        if (iframe) {
            return iframe.contentDocument;
        }

        return null;
    }
}

export class Highlight extends Mark {
    constructor(className, data, attributes) {
        super();
        this.className = className;
        this.data = data || {};
        this.attributes = attributes || {};
    }

    bind(element, container) {
        super.bind(element, container);

        for (var attr in this.data) {
            if (this.data.hasOwnProperty(attr)) {
                this.element.dataset[attr] = this.data[attr];
            }
        }

        for (var attr in this.attributes) {
            if (this.attributes.hasOwnProperty(attr)) {
                this.element.setAttribute(attr, this.attributes[attr]);
            }
        }

        if (this.className) {
            this.element.classList.add(this.className);
        }
    }

    render() {
        // Empty element
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }

        var docFrag = this.element.ownerDocument.createDocumentFragment();
        var ranges = this.getRanges();
        var offset = this.element.getBoundingClientRect();
        var container = this.container.getBoundingClientRect();

        for (var i = 0, len = ranges.length; i < len; i++) {
            var r = ranges[i];
            var el = svg.createElement("rect");
            el.setAttribute("x", r.left - offset.left + container.left);
            el.setAttribute("y", r.top - offset.top + container.top);
            el.setAttribute("height", r.height);
            el.setAttribute("width", r.width);
            docFrag.appendChild(el);
        }

        this.element.appendChild(docFrag);
    }
}

export class Underline extends Highlight {
    constructor(className, data, attributes) {
        super(className, data, attributes);
    }

    render() {
        // Empty element
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }

        var docFrag = this.element.ownerDocument.createDocumentFragment();
        var filtered = this.filteredRanges();
        var offset = this.element.getBoundingClientRect();
        var container = this.container.getBoundingClientRect();

        for (var i = 0, len = filtered.length; i < len; i++) {
            var r = filtered[i];

            var rect = svg.createElement("rect");
            rect.setAttribute("x", r.left - offset.left + container.left);
            rect.setAttribute("y", r.top - offset.top + container.top);
            rect.setAttribute("height", r.height);
            rect.setAttribute("width", r.width);
            rect.setAttribute("fill", "none");

            var line = svg.createElement("line");
            line.setAttribute("x1", r.left - offset.left + container.left);
            line.setAttribute("x2", r.left - offset.left + container.left + r.width);
            line.setAttribute("y1", r.top - offset.top + container.top + r.height - 1);
            line.setAttribute("y2", r.top - offset.top + container.top + r.height - 1);

            line.setAttribute("stroke-width", 1);
            line.setAttribute("stroke", "black"); //TODO: match text color?
            line.setAttribute("stroke-linecap", "square");

            docFrag.appendChild(rect);

            docFrag.appendChild(line);
        }

        this.element.appendChild(docFrag);
    }
}

function coords(el, container) {
    var offset = container.getBoundingClientRect();
    var rect = el.getBoundingClientRect();

    return {
        top: rect.top - offset.top,
        left: rect.left - offset.left,
        height: el.scrollHeight,
        width: el.scrollWidth
    };
}

function setCoords(el, coords) {
    el.style.setProperty("top", `${coords.top}px`, "important");
    el.style.setProperty("left", `${coords.left}px`, "important");
    el.style.setProperty("height", `${coords.height}px`, "important");
    el.style.setProperty("width", `${coords.width}px`, "important");
}

function contains(rect1, rect2) {
    return (
        rect2.right <= rect1.right && rect2.left >= rect1.left && rect2.top >= rect1.top && rect2.bottom <= rect1.bottom
    );
}
