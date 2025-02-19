import {EditorState, ContentState, SelectionState, RichUtils} from 'draft-js';
import reducer from '..';
import {applyLink} from '../../actions/toolbar';
import {LIMIT_CHARACTERS_OVERFLOW_STYLE} from 'core/editor3/helpers/characters-limit';

/**
 * @description Creates a new store state that contains the editorState and searchTerm.
 * @param {string} txt The text in the editor
 * @param {Object} searchTerm The searchTerm data (index, pattern, caseSensitive)
 * @returns {Object}
 */
function withSearchTerm(txt, searchTerm) {
    const editorState = EditorState.createWithContent(ContentState.createFromText(txt));
    const onChangeValue = function() {
        // noop
    };

    return {editorState, searchTerm, onChangeValue};
}

function fakeTabEvent({shift = false} = {}) {
    return new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: shift,
    });
}

describe('editor3.reducers', () => {
    it('EDITOR_CHANGE_STATE', () => {
        const editorState = EditorState.createEmpty();
        const onChangeValue = jasmine.createSpy();

        reducer({
            onChangeValue: onChangeValue,
            editorState: EditorState.createEmpty(),
        }, {
            type: 'EDITOR_CHANGE_STATE',
            payload: {editorState},
        });

        expect(onChangeValue).toHaveBeenCalled();
    });

    it('EDITOR_DRAG_DROP', () => {
        const data = {a: 1};

        const startState = {
            editorState: EditorState.createEmpty(),
            onChangeValue: () => ({}),
        };

        const {editorState} = reducer(startState, {
            type: 'EDITOR_DRAG_DROP',
            payload: {data: data, blockKey: null},
        });

        const contentState = editorState.getCurrentContent();
        const entityKey = contentState.getLastCreatedEntityKey();
        const entity = contentState.getEntity(entityKey);

        expect(entity.getType()).toBe('MEDIA');
        expect(entity.getMutability()).toBe('MUTABLE');
        expect(entity.getData()).toEqual({media: {a: 1}});
    });

    it('HIGHLIGHTS_RENDER highlight', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 1, pattern: 'Apple', caseSensitive: false},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_RENDER'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(block.getInlineStyleAt(0).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(13).has('HIGHLIGHT_STRONG')).toBe(true);
        expect(block.getInlineStyleAt(22).has('HIGHLIGHT')).toBe(false);
        expect(block.getInlineStyleAt(22).has('HIGHLIGHT_STRONG')).toBe(false);
        expect(block.getInlineStyleAt(26).has('HIGHLIGHT')).toBe(true);
    });

    it('HIGHLIGHTS_RENDER case sensitive', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 1, pattern: 'Apple', caseSensitive: true},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_RENDER'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(block.getInlineStyleAt(0).has('HIGHLIGHT')).toBe(false);
        expect(block.getInlineStyleAt(13).has('HIGHLIGHT_STRONG')).toBe(false);
    });

    it('HIGHLIGHTS_RENDER special characters', () => {
        const startState = withSearchTerm(
            '?apple banana ?apple ananas apple prune',
            {index: 1, pattern: '?Apple', caseSensitive: false},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_RENDER'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(block.getInlineStyleAt(0).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(1).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(14).has('HIGHLIGHT_STRONG')).toBe(true);
        expect(block.getInlineStyleAt(15).has('HIGHLIGHT_STRONG')).toBe(true);
    });

    it('HIGHLIGHTS_CRITERIA change term', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 1, pattern: 'apple', caseSensitive: false},
        );

        const state = reducer(startState, {
            type: 'HIGHLIGHTS_CRITERIA',
            payload: {
                diff: {banana: 'Banana'},
                caseSensitive: true,
            },
        });

        expect(state.searchTerm.index).toBe(-1);
        expect(state.searchTerm.caseSensitive).toBe(true);
        expect(state.searchTerm.pattern).toBe('banana');
    });

    it('HIGHLIGHTS_CRITERIA change sensitivity', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 1, pattern: 'apple', caseSensitive: false},
        );

        const state = reducer(startState, {
            type: 'HIGHLIGHTS_CRITERIA',
            payload: {caseSensitive: true, diff: {apple: 'Apple'}},
        });

        expect(state.searchTerm.index).toBe(0);
    });

    it('HIGHLIGHTS_FIND_NEXT', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 1, pattern: 'Apple', caseSensitive: false},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_FIND_NEXT'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(state.searchTerm.index).toBe(2);
        expect(block.getInlineStyleAt(0).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(13).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(26).has('HIGHLIGHT_STRONG')).toBe(true);
    });

    it('HIGHLIGHTS_FIND_NEXT past last', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 2, pattern: 'Apple', caseSensitive: false},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_FIND_NEXT'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(state.searchTerm.index).toBe(0);
        expect(block.getInlineStyleAt(0).has('HIGHLIGHT_STRONG')).toBe(true);
        expect(block.getInlineStyleAt(13).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(26).has('HIGHLIGHT')).toBe(true);
    });

    it('HIGHLIGHTS_FIND_NEXT wrong index', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 5, pattern: 'Apple', caseSensitive: false},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_FIND_NEXT'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(state.searchTerm.index).toBe(0);
        expect(block.getInlineStyleAt(0).has('HIGHLIGHT_STRONG')).toBe(true);
        expect(block.getInlineStyleAt(13).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(26).has('HIGHLIGHT')).toBe(true);
    });

    it('HIGHLIGHTS_FIND_PREV', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 1, pattern: 'Apple', caseSensitive: false, diff: {Apple: 'apple'}},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_FIND_PREV'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(state.searchTerm.index).toBe(0);
        expect(block.getInlineStyleAt(0).has('HIGHLIGHT_STRONG')).toBe(true);
        expect(block.getInlineStyleAt(13).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(26).has('HIGHLIGHT')).toBe(true);
    });

    it('HIGHLIGHTS_FIND_PREV before first', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 0, pattern: 'Apple', caseSensitive: false, diff: {Apple: 'apple'}},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_FIND_PREV'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(state.searchTerm.index).toBe(2);
        expect(block.getInlineStyleAt(0).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(13).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(26).has('HIGHLIGHT_STRONG')).toBe(true);
    });

    it('HIGHLIGHTS_FIND_PREV wrong index', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: -5, pattern: 'Apple', caseSensitive: false, diff: {Apple: 'apple'}},
        );

        const state = reducer(startState, {type: 'HIGHLIGHTS_FIND_PREV'});
        const block = state.editorState.getCurrentContent().getFirstBlock();

        expect(state.searchTerm.index).toBe(2);
        expect(block.getInlineStyleAt(0).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(13).has('HIGHLIGHT')).toBe(true);
        expect(block.getInlineStyleAt(26).has('HIGHLIGHT_STRONG')).toBe(true);
    });

    it('HIGHLIGHTS_FIND_REPLACE', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 1, pattern: 'Apple', caseSensitive: false},
        );

        const state = reducer(startState, {
            type: 'HIGHLIGHTS_REPLACE',
            payload: 'kiwi',
        });

        const text = state.editorState.getCurrentContent().getPlainText('\n');

        expect(text).toBe('apple banana kiwi ananas apple prune');
    });

    it('HIGHLIGHTS_FIND_REPLACE_ALL', () => {
        const startState = withSearchTerm(
            'apple banana apple ananas apple prune',
            {index: 1, pattern: 'Apple', caseSensitive: false},
        );

        const state = reducer(startState, {
            type: 'HIGHLIGHTS_REPLACE_ALL',
            payload: 'kiwi',
        });

        const text = state.editorState.getCurrentContent().getPlainText('\n');

        expect(text).toBe('kiwi banana kiwi ananas kiwi prune');
    });

    it('SPELLCHECKER_REPLACE_WORD', () => {
        const editorState = EditorState.createWithContent(
            ContentState.createFromText('abcd efgh'),
        );

        const state = reducer({
            editorState: editorState,
            onChangeValue: () => { /* no-op */ },
        }, {
            type: 'SPELLCHECKER_REPLACE_WORD',
            payload: {
                word: {text: 'efgh', offset: 5},
                newWord: '1234',
            },
        });

        const text = state.editorState.getCurrentContent().getPlainText();

        expect(text).toBe('abcd 1234');
    });

    it('TOOLBAR_APPLY_LINK', () => {
        const contentState = ContentState.createFromText('some text');

        const blockKey = contentState.getFirstBlock().getKey();
        const selectionState = SelectionState.createEmpty(blockKey);
        const updatedSelection = selectionState.merge({
            focusKey: blockKey,
            focusOffset: 4,
        }) as SelectionState;

        const editorState = EditorState.createWithContent(contentState);
        const selectedEditorState = EditorState.forceSelection(editorState, updatedSelection);

        const state = reducer(
            {
                editorState: selectedEditorState,
                onChangeValue: jasmine.createSpy('onChangeValue'),
            },
            applyLink({link: 'http://example.com'}),
        );

        let updatedContent = state.editorState.getCurrentContent();
        let entity = updatedContent.getEntity(updatedContent.getLastCreatedEntityKey());

        expect(entity.type).toBe('LINK');
        expect(entity.data.link.link).toBe('http://example.com');
        expect(state.onChangeValue).toHaveBeenCalled();

        const nextState = reducer(
            {
                editorState: state.editorState,
                onChangeValue: jasmine.createSpy('onChangeValue'),
            },
            applyLink({link: 'http://foo.com'}, entity),
        );

        updatedContent = nextState.editorState.getCurrentContent();
        entity = updatedContent.getEntity(updatedContent.getLastCreatedEntityKey());

        expect(entity.data.link.link).toBe('http://foo.com');
        expect(nextState.onChangeValue).toHaveBeenCalled();
    });

    it('EDITOR_PUSH_STATE', () => {
        const contentState = ContentState.createFromText('some text');
        const nextContentState = ContentState.createFromText('some other text');

        const nextState = reducer({
            editorState: EditorState.createWithContent(contentState),
            onChangeValue: jasmine.createSpy('onChangeValue'),
        }, {
            type: 'EDITOR_PUSH_STATE',
            payload: {contentState: nextContentState},
        });

        expect(nextState.editorState.getCurrentContent().getPlainText()).toBe(nextContentState.getPlainText());
    });

    it('EDITOR_TAB insert tab character', () => {
        const contentState = ContentState.createFromText('foo');
        let editorState = EditorState.createWithContent(contentState);

        editorState = EditorState.moveFocusToEnd(editorState);

        const nextState = reducer({
            editorState: editorState,
            editorFormat: ['tab', 'tab as spaces'],
            onChangeValue: jasmine.createSpy('onChangeValue'),
        }, {
            type: 'EDITOR_TAB',
            payload: fakeTabEvent({shift: false}),
        });

        expect(nextState.editorState.getCurrentContent().getPlainText()).toBe('foo\t');
    });

    it('EDITOR_TAB insert tab as spaces when pressing shift', () => {
        const contentState = ContentState.createFromText('foo');
        let editorState = EditorState.createWithContent(contentState);

        editorState = EditorState.moveFocusToEnd(editorState);

        const nextState = reducer({
            editorState: editorState,
            editorFormat: ['tab', 'tab as spaces'],
            onChangeValue: jasmine.createSpy('onChangeValue'),
        }, {
            type: 'EDITOR_TAB',
            payload: fakeTabEvent({shift: true}),
        });

        expect(nextState.editorState.getCurrentContent().getPlainText()).toBe('foo        ');
    });

    it('EDITOR_TAB does not insert anything without formatting options', () => {
        const contentState = ContentState.createFromText('foo');
        let editorState = EditorState.createWithContent(contentState);

        editorState = EditorState.moveFocusToEnd(editorState);

        const nextState = reducer({
            editorState: editorState,
            onChangeValue: jasmine.createSpy('onChangeValue'),
        }, {
            type: 'EDITOR_TAB',
            payload: fakeTabEvent({shift: false}),
        });

        expect(nextState.editorState.getCurrentContent().getPlainText()).toBe('foo');
    });

    it('EDITOR_TAB on lists does not change text', () => {
        const contentState = ContentState.createFromText('list item');
        let editorState = EditorState.createWithContent(contentState);

        editorState = RichUtils.toggleBlockType(editorState, 'ordered-list-item');

        // indent right
        let nextState = reducer({
            editorState,
            editorFormat: ['tab', 'tab as spaces'],
            onChangeValue: jasmine.createSpy('onChangeValue'),
        }, {
            type: 'EDITOR_TAB',
            payload: fakeTabEvent(),
        });

        editorState = nextState.editorState as EditorState;

        expect(editorState.getCurrentContent().getFirstBlock().getText()).toBe('list item');

        // indent left
        nextState = reducer({
            editorState,
            editorFormat: ['tab', 'tab as spaces'],
            onChangeValue: jasmine.createSpy('onChangeValue'),
        }, {
            type: 'EDITOR_TAB',
            payload: fakeTabEvent({shift: true}),
        });

        editorState = nextState.editorState as EditorState;

        expect(editorState.getCurrentContent().getFirstBlock().getText()).toBe('list item');
    });

    it('EDITOR_CHANGE_LIMIT_CONFIG changes the config', () => {
        const contentState = ContentState.createFromText('some loooong text');
        const nextState = reducer({
            editorState: EditorState.createWithContent(contentState),
            limitConfig: {ui: 'limit', chars: 5},
        }, {
            type: 'EDITOR_CHANGE_LIMIT_CONFIG',
            payload: {ui: 'highlight', chars: 10},
        });

        expect(nextState.limitConfig.ui).toBe('highlight');
        expect(nextState.limitConfig.chars).toBe(10);

        const block = nextState.editorState.getCurrentContent().getLastBlock();

        expect(block.getInlineStyleAt(10).toArray()).toContain(LIMIT_CHARACTERS_OVERFLOW_STYLE);
        expect(block.getInlineStyleAt(9).toArray()).not.toContain(LIMIT_CHARACTERS_OVERFLOW_STYLE);
    });
});
