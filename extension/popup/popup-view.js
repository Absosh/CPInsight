export class PopupView {
  constructor(root) {
    this.root = root;
  }

  render(state) {
    this.root.dataset.state = state.loading ? 'loading' : 'ready';
    this.root.innerHTML = '';
  }
}
