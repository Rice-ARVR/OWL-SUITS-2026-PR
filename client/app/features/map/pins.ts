export class Pin {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  description?: string;

  constructor(
    id: string,
    position: { lat: number; lng: number },
    title: string,
    description?: string,
  ) {
    this.id = id;
    this.position = position;
    this.title = title;
    this.description = description;
  }
}
