// @ts-check
/** eslint-env browser */ /* global Vue */

/** 
 * @typedef {import('../../../src/model').Todo} Todo 
 */

import { factory } from './api-client/factory.js';

const { TodoController: api, AuthController: auth } = factory({
  url: 'https://localhost:3000'
}, opts => {
  const result = {
    /**
     * @template {Function} V
     * @this {V}
     * @param {Parameters<V>} params
     * @returns {Promise<[Awaited<ReturnType<V>>]>}
     */
    async $stream(...params) {
      console.log(opts, params);
      // @ts-ignore
      return null;
    }
  };
  return result;
});

api.complete.$stream('100', true).then(v => v[0]);

/*
 * Code was taken, and adapted from https://github.com/tastejs/todomvc/tree/gh-pages/examples/vue
 */
Vue.component('app', {
  data() {
    return {
      creating: '',
      editing: null,
      ogText: '',
      items: []
    };
  },
  directives: {
    ['todo-focus'](el, binding) {
      if (binding.value) {
        el.focus();
      }
    }
  },
  computed: {
    remaining() {
      return this.items.filter(x => !x.completed).length;
    }
  },
  template: `
  <section class="todoapp">
    <header class="header">
      <h1>Todo</h1>
      <input class="new-todo" autofocus autocomplete="off" placeholder="What needs to be done?" v-model="creating" @keyup.enter="create(creating)">
    </header>
    <section class="main" v-show="items.length">
      <ul class="todo-list">
        <li class="todo" v-for="item in items" :key="item.id" :class="{completed: item.completed, editing: item == editing}">
          <div class="view">
            <input class="toggle" type="checkbox" v-model="item.completed" v-on:change="complete(item)">
            <label @dblclick="startEdit(item)">{{item.text}}</label>
            <button class="destroy" v-on:click="remove(item.id)"></button>
          </div>
          <input class="edit" type="text"
            v-model="item.text" v-todo-focus="item == editing" 
            @blur="edit()" 
            @keyup.enter="edit()" @keyup.esc="cancelEdit()"
          >
        </li>
      </ul>
    </section>
    <footer class="footer" v-show="items.length">
      <span class="todo-count">
        <strong v-text="remaining"></strong> left
      </span>
      <button class="clear-completed" @click="removeCompleted" v-show="items.length > remaining">
        Clear completed
      </button>
    </footer>
  </section>`,
  beforeMount() {
    return api.getAll({}).then(items => this.items = items);
  },
  methods: {
    getAll() {
      return api.getAll({}).then(items => this.items = items);
    },
    remove(id) {
      return api.remove(id).then(() => this.getAll());
    },
    removeCompleted() {
      return api.deleteAllCompleted().then(() => this.getAll());
    },
    complete(/** @type {Todo} */ item) {
      return api.complete(item.id, item.completed).then(() => this.getAll());
    },
    startEdit(item) {
      this.ogText = item.text;
      this.editing = item;
    },
    cancelEdit() {
      if (this.editing) {
        this.editing.text = this.ogText;
        this.editing = null;
      }
    },
    edit() {
      if (this.editing && this.editing.text) {
        return api.update(this.editing.id, { text: this.editing.text }).then(() => {
          this.editing = null;
        });
      } else {
        this.cancelEdit();
      }
    },
    create(text) {
      this.creating = '';
      return api.create({ text }).then(() => this.getAll());
    }
  }
});

window.setTimeout(() => new Vue({ el: '#app' }), 1);