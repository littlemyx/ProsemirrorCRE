// import "prosemirror-view/style/prosemirror.css";
// import "prosemirror-menu/style/menu.css";
import "./index.css";

import React from "react";
import { schema } from "prosemirror-schema-basic";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, Command, toggleMark } from "prosemirror-commands";
import { MarkType, Schema, NodeType } from "prosemirror-model";
import { history, redo, undo } from "prosemirror-history";
import { useProseMirror, ProseMirror } from "use-prosemirror";
import { EditorState } from "prosemirror-state";
import {
  blockTypeItem,
  Dropdown,
  menuBar,
  DropdownSubmenu,
  undoItem,
  redoItem,
  icons,
  MenuItem,
  MenuElement,
  MenuItemSpec
} from "prosemirror-menu";

import cut from "./cut";

import spellcheckPlugin from "./plugins/spellchecker";
import autocompletePlugin, { tabHandler } from "./plugins/autocomplete";

function cmdItem(cmd: Command, options: Partial<MenuItemSpec>) {
  const passedOptions: MenuItemSpec = {
    label: options.title as string | undefined,
    run: cmd
  };
  for (let prop in options)
    (passedOptions as any)[prop] = (options as any)[prop];
  if (!options.enable && !options.select)
    passedOptions[options.enable ? "enable" : "select"] = (state) => cmd(state);

  return new MenuItem(passedOptions);
}

function markActive(state: EditorState, type: MarkType) {
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks || $from.marks());
  else return state.doc.rangeHasMark(from, to, type);
}

function markItem(markType: MarkType, options: Partial<MenuItemSpec>) {
  const passedOptions: Partial<MenuItemSpec> = {
    active(state) {
      return markActive(state, markType);
    }
  };
  for (const prop in options)
    (passedOptions as any)[prop] = (options as any)[prop];
  return cmdItem(toggleMark(markType), passedOptions);
}

type MenuItemResult = {
  /// A menu item to toggle the [strong mark](#schema-basic.StrongMark).
  toggleStrong?: MenuItem;

  /// A menu item to toggle the [emphasis mark](#schema-basic.EmMark).
  toggleEm?: MenuItem;

  /// A menu item to set the current textblock to be a normal
  /// [paragraph](#schema-basic.Paragraph).
  makeParagraph?: MenuItem;

  /// Menu items to set the current textblock to be a
  /// [heading](#schema-basic.Heading) of level _N_.
  makeHead1?: MenuItem;
  makeHead2?: MenuItem;
  makeHead3?: MenuItem;
  makeHead4?: MenuItem;
  makeHead5?: MenuItem;
  makeHead6?: MenuItem;

  /// A menu item to set the current textblock to be a
  /// [code block](#schema-basic.CodeBlock).
  makeCodeBlock?: MenuItem;

  /// Inline-markup related menu items.
  inlineMenu: MenuElement[][];

  /// A dropdown containing the items for making the current
  /// textblock a paragraph, code block, or heading.
  typeMenu: Dropdown;

  /// An array of arrays of menu elements for use as the full menu
  /// for, for example the [menu
  /// bar](https://github.com/prosemirror/prosemirror-menu#user-content-menubar).
  fullMenu: MenuElement[][];
};

/// Given a schema, look for default mark and node types in it and
/// return an object with relevant menu items relating to those marks.
export function buildMenuItems(schema: Schema): MenuItemResult {
  const r: MenuItemResult = {} as any;
  let mark: MarkType | undefined;
  if ((mark = schema.marks.strong))
    r.toggleStrong = markItem(mark, {
      title: "Toggle strong style",
      icon: icons.strong
    });
  if ((mark = schema.marks.em))
    r.toggleEm = markItem(mark, { title: "Toggle emphasis", icon: icons.em });

  let node: NodeType | undefined;

  if ((node = schema.nodes.paragraph))
    r.makeParagraph = blockTypeItem(node, {
      title: "Change to paragraph",
      label: "Plain"
    });

  if ((node = schema.nodes.heading))
    for (let i = 1; i <= 10; i++)
      (r as any)["makeHead" + i] = blockTypeItem(node, {
        title: "Change to heading " + i,
        label: "Level " + i,
        attrs: { level: i }
      });

  r.typeMenu = new Dropdown(
    cut([
      r.makeParagraph,
      r.makeCodeBlock,
      r.makeHead1 &&
        new DropdownSubmenu(
          cut([
            r.makeHead1,
            r.makeHead2,
            r.makeHead3,
            r.makeHead4,
            r.makeHead5,
            r.makeHead6
          ]),
          { label: "Heading" }
        )
    ]),
    { label: "Type..." }
  );

  r.inlineMenu = [cut([r.toggleStrong, r.toggleEm])];

  r.fullMenu = r.inlineMenu.concat([[r.typeMenu]]);

  return r;
}

const mySchema = new Schema({
  nodes: {
    doc: schema.nodes.doc,
    paragraph: schema.nodes.paragraph,
    heading: schema.nodes.heading,
    text: schema.nodes.text
  },
  marks: schema.spec.marks
});

const opts: Parameters<typeof useProseMirror>[0] = {
  schema: schema,
  // plugins: exampleSetup({ schema: mySchema })
  plugins: [
    menuBar({
      floating: true,
      content: buildMenuItems(schema).fullMenu
    }),
    // spellcheckPlugin(),
    autocompletePlugin(),

    // history(),
    keymap({
      ...baseKeymap
      // "Mod-z": undo,
      // "Mod-y": redo,
      // "Mod-Shift-z": redo,
      // Tab: tabHandler
    })
  ]
};

const App = () => {
  const [state, setState] = useProseMirror(opts);

  return (
    <div className="App">
      <div className="ProseMirrorContainer">
        <ProseMirror
          className="ProseMirror"
          state={state}
          onChange={setState}
        />
      </div>
    </div>
  );
};

export default App;
