// @ts-check

Vue.component('todo-item', {

})

function init() {
  const newTodo = document.querySelector('#add');
  const input = document.querySelector('#add input');
  const markComplete = document.querySelector('#toggle-all');
  const list = document.querySelector('#list');

  const createItem = (text) => {
    fetch('/todo', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: input.value
      })
    }).then(reloadList);
  }

  const removeItem = (id) => {
    fetch(`/todo/${id}`, { method: 'DELETE' }).then(reloadList);
  }

  const complete = (id, completed) => {
    fetch(`/todo/${id}/complete?completed=${completed}`, { method: 'put' }).then(reloadList);
  }

  const editItem = (id, text) => {
    fetch(`/todo/${id}`, { method: 'put', body: JSON.stringify({ text }), header: 'Content-Type: application/json' }).then(reloadList);
  }

  const renderItem = (el) => {
    const li = document.createElement('li');
    if (el.completed) {
      li.className = 'completed';
    }

    const view = document.createElement('div'); {
      view.className = 'view';
      const toggle = document.createElement('input'); {
        toggle.type = 'checkbox';
        toggle.className = 'toggle';
        toggle.addEventListener('click', () => complete(el.id, !el.completed));

        if (el.completed) {
          toggle.checked = true;
        }

        view.append(toggle);
      }
      const label = document.createElement('label'); {
        label.innerText = el.text;
        view.append(label);
      }

      const remove = document.createElement('button'); {
        remove.className = 'destroy';
        remove.addEventListener('click', () => removeItem(el.id));
        view.append(remove);
      }

      li.appendChild(view);
    }

    const edit = document.createElement('input'); {
      edit.className = 'edit';
      edit.value = el.text;
      li.appendChild(edit);
    }

    return li;
  };

  const reloadList = () => {
    fetch('/todo').then(v => v.json()).then(items => {
      while (list.childNodes.length) { // Clear out
        list.removeChild(list.childNodes.item(0));
      }
      for (const el of items) {
        list.appendChild(renderItem(el));
      }
    });
  }

  newTodo.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value) {
      createItem(input.value);
      input.value = '';
    }
    return false;
  });

  reloadList();
}