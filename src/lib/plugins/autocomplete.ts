/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Decoration, DecorationSet } from "prosemirror-view";
import { Mark } from "prosemirror-model";
import {
  Plugin,
  Selection,
  TextSelection,
  Transaction,
  EditorState,
  PluginKey
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { ReplaceStep } from "prosemirror-transform";

const DICT = [
  "donkey",
  "dolphin",
  "dog",
  "zebra",
  "snake",
  "snail",
  "sparrow",
  "spider",
  "shark",
  "lion",
  "lobster",
  "lizard",
  "lama",
  "locust"
];

function getSuggestions(prefix: string) {
  return DICT.filter(
    (key) => key.length > prefix.length && key.startsWith(prefix.toLowerCase())
  );
}

function createCorrectionFunction(
  view: EditorView,
  from: number,
  to: number,
  mark?: Mark
) {
  return (correction: string) => {
    let tr = view.state.tr.replaceWith(
      from,
      to,
      view.state.schema.text(correction, mark)
    );
    const step = tr.steps[0] as ReplaceStep;
    const map = step.getMap();
    const stepTo = map.map(step.to, 1);
    tr = tr.setSelection(TextSelection.create(tr.doc, stepTo));
    view.dispatch(tr);
    view.focus();
  };
}

function addCSSclass(rules: any[]) {
  const style = document.createElement("style");
  style.appendChild(document.createTextNode("")); // WebKit hack :(
  document.head.appendChild(style);
  const sheet = style.sheet as CSSStyleSheet;

  rules.forEach((rule, index) => {
    try {
      if ("insertRule" in sheet) {
        sheet.insertRule(rule.selector + "{" + rule.rule + "}", index);
      } else {
        throw new Error("Can't add CSS rules");
      }
    } catch (e) {
      console.error(e);
    }
  });
}

function getSbox() {
  // create suggestions widget
  let sbox = document.getElementById("suggestBox");
  if (sbox) return sbox;

  addCSSclass([
    {
      selector: ".spell-error",
      rule:
        'background-image: url("data:image/gif;base64,R0lGODlhBAADAIABAP8AAP///yH5BAEAAAEALAAAAAAEAAMAAAIFRB5mGQUAOw=="); background-position: bottom; background-repeat: repeat-x;'
    },
    {
      selector: "#suggestBox",
      rule: "display:inline-block; overflow:hidden; border:solid black 1px;"
    },
    {
      selector: "#suggestBox > select",
      rule: "padding:10px; margin:-5px -20px -5px -5px;"
    },
    {
      selector: "#suggestBox > select > option:hover",
      rule: "box-shadow: 0 0 10px 100px #4A8CF7 inset; color: white;"
    }
  ]);

  sbox = document.createElement("div");
  sbox.style.zIndex = "100000";
  sbox.id = "suggestBox";
  sbox.style.position = "fixed";
  sboxHide(sbox);

  const selwidget = document.createElement("select");
  selwidget.multiple = true;
  sbox.appendChild(selwidget);

  /*sbox.onmouseout = (e => {
		let related = (e.relatedTarget ? e.relatedTarget.tagName : null);
		console.log(related)
		if (related !== 'SELECT' && related !== 'OPTION') sboxHide(sbox)
	});*/

  document.body.appendChild(sbox);
  return sbox;
}

function sboxShow(
  sbox: HTMLElement,
  viewDom: Element,
  token: any,
  screenPos: { x: string | number; y: string | number },
  items: any[],
  hourglass: boolean,
  correctFunc: (correction: string) => void
) {
  let selwidget = sbox.children[0];

  const isSafari =
    navigator.vendor &&
    navigator.vendor.indexOf("Apple") > -1 &&
    navigator.userAgent &&
    !navigator.userAgent.match("CriOS");
  const separator = !isSafari && (hourglass || items.length > 0); // separator line does not work well on safari

  let options = "";
  items.forEach(
    (s) => (options += '<option value="' + s + '">' + s + "</option>")
  );
  if (hourglass)
    options += '<option disabled="disabled">&nbsp;&nbsp;&nbsp;&#8987;</option>';
  if (separator)
    options +=
      '<option style="min-height:1px; max-height:1px; padding:0; background-color: #000000;" disabled>&nbsp;</option>';
  options += '<option value="##ignoreall##">Ignore&nbsp;All</option>';

  const indexInParent = [].slice
    .call(selwidget.parentElement.children)
    .indexOf(selwidget);
  selwidget.innerHTML = options;
  selwidget = selwidget.parentElement.children[indexInParent];

  const fontSize = window
    .getComputedStyle(viewDom, null)
    .getPropertyValue("font-size");
  // @ts-ignore
  selwidget.style.fontSize = fontSize;
  // @ts-ignore
  selwidget.size = selwidget.length;
  // @ts-ignore
  if (separator) selwidget.size--;
  // @ts-ignore
  selwidget.value = -1;

  // position widget
  let viewrect = viewDom.getBoundingClientRect();
  let widgetRect = sbox.getBoundingClientRect();
  if (
    Number(screenPos.x) + widgetRect.width > viewrect.right &&
    viewrect.right - widgetRect.width > viewrect.left
  )
    screenPos.x = viewrect.right - widgetRect.width - 2;
  if (
    Number(screenPos.y) + widgetRect.height > viewrect.bottom &&
    viewrect.bottom - sbox.offsetHeight > viewrect.top
  )
    screenPos.y = viewrect.bottom - sbox.offsetHeight - 8;

  sbox.style.left = screenPos.x + "px";
  sbox.style.top = screenPos.y + "px";
  sbox.focus();
  // @ts-ignore
  selwidget.onchange = (event: KeyboardEvent) => {
    sboxHide(sbox);
    let correction = (event.target as HTMLInputElement).value;
    if (correction == "##ignoreall##") {
      // typo.ignore(token);
      correction = token;
    }
    correctFunc(correction);
  };
}

function sboxHide(sbox: HTMLElement) {
  sbox.style.top = sbox.style.left = "-1000px";
  // typo.suggest(); // disable any running suggeations search
}

interface IEditorState {
  doc: Node;
}

interface IPluginState {
  init: (
    this: Plugin<IPluginState, any>,
    config: { [key: string]: any },
    instance: EditorState<any>
  ) => IPluginState;
  apply: (
    this: Plugin<IPluginState, any>,
    tr: Transaction<any>,
    value: IPluginState,
    oldState: EditorState<any>,
    newState: EditorState<any>
  ) => IPluginState;
  lastWord: string;
}

function autocompletePlugin() {
  return new Plugin<IPluginState>({
    view(view) {
      view.dom.spellcheck = false;
      return {};
    },

    state: {
      init() {
        return {
          lastWord: "",
          ...this.spec.state
        };
      },
      apply(tr, prevPluginState, oldState, state) {
        let { lastWord }: IPluginState = prevPluginState;
        // sboxHide(getSbox());
        // if (tr.steps[0] instanceof ReplaceStep) {
        //   const step = tr.steps[0];
        //   const node = state.doc.nodeAt(step.from);
        //   const text = node?.text ?? "";
        //   const wordRegEx = /\w+/g;
        //   const letterRegEx = /\w/g;
        //   const matchWord = text.match(wordRegEx);
        //   const matchLetter =
        //     text.length > 0 ? text[text.length - 1].match(letterRegEx) : null;

        //   if (matchWord !== null && matchLetter !== null) {
        //     lastWord = matchWord[matchWord.length - 1];
        //   } else {
        //     lastWord = "";
        //   }
        // }

        // console.log(lastWord);

        console.log("apply");
        return {
          lastWord,
          ...this.spec.state
        };
      }
    },
    props: {
      // decorations(state: EditorState) {
      //   const { decos } = this.getState(state);
      //   return decos;
      // },
      // handleKeyDown(view: EditorView, event: KeyboardEvent) {
      //   if (event.key === "Tab") {
      //     const {
      //       $cursor: { pos: endOfDocPosition }
      //     } = Selection.atEnd(view.state.doc) as TextSelection;
      //     const {
      //       $cursor: { pos: cursorPositions }
      //     } = view.state.selection as TextSelection;
      //     console.log(`tab with cursor position: ${cursorPositions}`);
      //     const node = view.state.doc.nodeAt(cursorPositions - 1);
      //     console.log(node);
      //     const resolvedPos = view.state.doc.resolve(cursorPositions);
      //     const parentInfo = resolvedPos.parent.childBefore(
      //       resolvedPos.parentOffset
      //     );
      //     const linkNode = parentInfo.node;
      //     const linkStartPos = parentInfo.offset;
      //     const posInParent = resolvedPos.parentOffset;
      //     const offsetInLink = posInParent - linkStartPos;
      //     const linkFrom = cursorPositions - offsetInLink;
      //     const linkTo = linkFrom + linkNode.nodeSize;
      //     console.log(`start: ${linkFrom} end: ${linkTo}`);
      //     let sbox = getSbox();
      //     let token = view.state.doc.textBetween(linkFrom, linkTo, " ");
      //     if (cursorPositions === linkTo) {
      //       const wordRegEx = /\w+/g;
      //       const matchWord = node.text.match(wordRegEx);
      //       const word = matchWord[matchWord.length - 1];
      //       const cursorViewPortPosition = view.coordsAtPos(cursorPositions);
      //       const screenPos = {
      //         x: cursorViewPortPosition.left,
      //         y: cursorViewPortPosition.top + 10
      //       };
      //       const suggestions = getSuggestions(word);
      //       if (suggestions.length) {
      //         sboxShow(
      //           sbox,
      //           view.dom,
      //           word,
      //           screenPos,
      //           suggestions,
      //           false,
      //           createCorrectionFunction(
      //             view,
      //             linkTo - word.length,
      //             linkTo,
      //             node.marks
      //           )
      //         );
      //       }
      //     }
      //     return true;
      //   }
      //   return false;
      // },
      // handleClick(view: EditorView, event: MouseEvent) {
      //   sboxHide(getSbox());
      // }
      // handleTextInput(
      //   view: EditorView,
      //   from: number,
      //   to: number,
      //   text: string
      // ) {
      //   // Suggest only in the end of text
      //   // if (view.state.doc.content.size - 1 === from) {
      //   //   sync(
      //   //     function () {
      //   //       const { lastWord } = this.getState(view.state);
      //   //       const correction = DICT[lastWord];
      //   //       if (correction !== undefined) {
      //   //         const node = view.state.schema.text(
      //   //           correction,
      //   //           view.state.schema.marks.strong.create()
      //   //         );
      //   //         // Со вставкой текста постоянно происходит какая-то оказия
      //   //         let tr = view.state.tr.insert(view.state.selection.from, node);
      //   //         tr = tr.setSelection(
      //   //           TextSelection.create(tr.doc, view.state.selection.from)
      //   //         );
      //   //         view.dispatch(tr);
      //   //       }
      //   //     }.bind(this)
      //   //   );
      //   // }
      //   return false;
      // }
    }
  });
}

// TODO: this is a hack to get the plugin to work with delayed updates
const sync = (function () {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  return function (callback: () => void) {
    if (timerId) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      clearTimeout(timerId);
      callback();
    }, 1000);
  };
})();

export default autocompletePlugin;
