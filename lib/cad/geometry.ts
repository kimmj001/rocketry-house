import type { RocketComponent, RocketProject } from "@/lib/types";

export function sortComponents(components: RocketComponent[]) {
  return [...components].sort((a, b) => a.position - b.position);
}

export function totalLength(components: RocketComponent[]) {
  return Math.max(...components.map((component) => component.position + component.length));
}

export function exportDesignJson(project: RocketProject) {
  return JSON.stringify(
    {
      schema: "rocketry-house.design.v1",
      project: project.title,
      components: sortComponents(project.components)
    },
    null,
    2
  );
}

export function exportOrkLikeXml(project: RocketProject) {
  const components = sortComponents(project.components)
    .map(
      (component) =>
        `    <component id="${component.id}" type="${component.type}" name="${component.name}" length="${component.length}" diameter="${component.diameter}" mass="${component.mass}" material="${component.material}" position="${component.position}" />`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rocketry-house-design version="1">
  <rocket name="${project.title}">
${components}
  </rocket>
</rocketry-house-design>`;
}

export function parseOrkLikeXml(xml: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "application/xml");
  return Array.from(document.querySelectorAll("component")).map((node) => ({
    id: node.getAttribute("id") ?? crypto.randomUUID(),
    type: (node.getAttribute("type") ?? "body_tube") as RocketComponent["type"],
    name: node.getAttribute("name") ?? "Imported component",
    length: Number(node.getAttribute("length") ?? 100),
    diameter: Number(node.getAttribute("diameter") ?? 54),
    wallThickness: Number(node.getAttribute("wallThickness") ?? 2),
    material: node.getAttribute("material") ?? "Imported material",
    mass: Number(node.getAttribute("mass") ?? 20),
    position: Number(node.getAttribute("position") ?? 0)
  }));
}

export function createStlExportJob(project: RocketProject) {
  return {
    status: "queued",
    message: "STL generation request is ready for the mesh export worker.",
    projectId: project.id
  };
}
