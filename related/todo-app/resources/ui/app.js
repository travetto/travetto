// @ts-check
/* eslint-env browser */ /* global Vue */

/*
 * Code was taken, and adapted from https://github.com/tastejs/todomvc/tree/gh-pages/examples/vue
 */

const fetchData = () => fetch('/todo').then(v => v.json());

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
    return fetchData().then(items => this.items = items);
  },
  methods: {
    fetchData() {
      return fetchData().then(items => this.items = items);
    },
    remove(id) {
      return fetch(`/todo/${id}`, { method: 'DELETE' }).then(() => this.fetchData());
    },
    removeCompleted() {
      return fetch('/todo?completed=true', { method: 'DELETE' }).then(() => this.fetchData());
    },
    complete(item) {
      return fetch(`/todo/${item.id}/complete?completed=${item.completed}`, { method: 'put' }).then(() => this.fetchData());
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
        return fetch(`/todo/${this.editing.id}`, {
          method: 'put',
          body: JSON.stringify({ text: this.editing.text }),
          headers: { 'Content-Type': 'application/json' }
        }).then(() => {
          this.editing = null;
        });
      } else {
        this.cancelEdit();
      }
    },
    create(text) {
      this.creating = '';
      return fetch('/todo', {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      }).then(() => this.fetchData());
    }
  }
});

window.setTimeout(() => new Vue({ el: '#app' }), 1);