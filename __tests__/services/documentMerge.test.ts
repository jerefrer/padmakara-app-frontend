import { buildEventDocuments } from "../../services/retreatService";

describe("buildEventDocuments", () => {
  it("pins the transcript first as a featured pdf", () => {
    const docs = buildEventDocuments({
      id: 9,
      transcripts: [{ id: 1, language: "en", originalFilename: "t.pdf" }],
      eventFiles: [
        { id: 5, title: "Slides", originalFilename: "s.pptx", extension: "pptx", fileType: "document", sortOrder: 1 },
        { id: 4, title: "Photo", originalFilename: "p.jpg", extension: "jpg", fileType: "image", sortOrder: 0 },
      ],
    } as any);
    expect(docs[0]).toMatchObject({ kind: "transcript", featured: true, viewer: "pdf" });
    // files after transcript, ordered by sortOrder
    expect(docs[1]).toMatchObject({ kind: "file", id: 4, viewer: "image" });
    expect(docs[2]).toMatchObject({ kind: "file", id: 5, viewer: "download" });
  });

  it("returns only files when there is no transcript", () => {
    const docs = buildEventDocuments({
      id: 9, transcripts: [],
      eventFiles: [{ id: 4, originalFilename: "p.jpg", extension: "jpg", fileType: "image", sortOrder: 0 }],
    } as any);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ kind: "file", viewer: "image" });
  });

  it("marks pdf files as pdf viewer", () => {
    const docs = buildEventDocuments({
      id: 9, transcripts: [],
      eventFiles: [{ id: 4, originalFilename: "n.pdf", extension: "pdf", fileType: "document", sortOrder: 0 }],
    } as any);
    expect(docs[0].viewer).toBe("pdf");
  });

  it("carries the sensitive flag of files so the app can tell when a copy is watermarked", () => {
    const docs = buildEventDocuments({
      id: 9, transcripts: [],
      eventFiles: [
        { id: 4, originalFilename: "n.pdf", extension: "pdf", fileType: "document", sortOrder: 0, sensitive: true },
        { id: 5, originalFilename: "m.pdf", extension: "pdf", fileType: "document", sortOrder: 1 },
      ],
    } as any);
    expect(docs[0].sensitive).toBe(true);
    expect(docs[1].sensitive).toBe(false);
  });
});
