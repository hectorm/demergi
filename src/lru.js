export class LRU {
  #list;
  #map;
  #max;

  constructor(max = -1) {
    this.#list = new List();
    this.#map = new Map();
    this.#max = max;
  }

  get max() {
    return this.#max;
  }

  get size() {
    return this.#list.size;
  }

  set(key, value, ttl = -1) {
    const expiry = ttl > -1 ? Date.now() + ttl * 1000 : -1;
    const cached = this.#map.get(key);
    if (cached === undefined) {
      const el = new Element({ key, value, expiry });
      this.#list.insert(el, this.#list.root);
      this.#map.set(el.data.key, el);
      if (this.#max > -1 && this.#max < this.#list.size) {
        const back = this.#list.back();
        this.#list.remove(back);
        this.#map.delete(back.data.key);
      }
    } else {
      this.#list.move(cached, this.#list.root);
      cached.data.value = value;
      cached.data.expiry = expiry;
    }
  }

  get(key) {
    const cached = this.#map.get(key);
    if (cached === undefined) {
      return undefined;
    }
    if (cached.data.expiry > -1 && cached.data.expiry < Date.now()) {
      this.#list.remove(cached);
      this.#map.delete(cached.data.key);
      return undefined;
    }
    this.#list.move(cached, this.#list.root);
    return cached.data.value;
  }

  delete(key) {
    const cached = this.#map.get(key);
    if (cached === undefined) {
      return undefined;
    }
    this.#list.remove(cached);
    this.#map.delete(cached.data.key);
    return cached.data.value;
  }

  *[Symbol.iterator]() {
    for (
      let el = this.#list.front();
      el !== undefined;
      el = this.#list.next(el)
    ) {
      yield el.data.value;
    }
  }
}

class List {
  constructor() {
    this.root = new Element();
    this.root.list = this;
    this.root.prev = this.root;
    this.root.next = this.root;
    this.size = 0;
  }

  back() {
    return this.size > 0 ? this.root.prev : undefined;
  }

  front() {
    return this.size > 0 ? this.root.next : undefined;
  }

  prev(el) {
    return el.prev !== el.list.root ? el.prev : undefined;
  }

  next(el) {
    return el.next !== el.list.root ? el.next : undefined;
  }

  remove(el) {
    if (el.list === this) {
      el.prev.next = el.next;
      el.next.prev = el.prev;
      el.next = null;
      el.prev = null;
      el.list = null;
      this.size--;
    }
  }

  insert(el, at) {
    if (el !== at && at.list === this) {
      el.prev = at;
      el.next = at.next;
      el.prev.next = el;
      el.next.prev = el;
      el.list = this;
      this.size++;
    }
  }

  move(el, at) {
    if (el.list === this && el !== at && el !== at.next && at.list === this) {
      el.prev.next = el.next;
      el.next.prev = el.prev;
      el.prev = at;
      el.next = at.next;
      el.prev.next = el;
      el.next.prev = el;
    }
  }
}

class Element {
  constructor(data) {
    this.data = data;
    this.list = null;
    this.prev = null;
    this.next = null;
  }
}
