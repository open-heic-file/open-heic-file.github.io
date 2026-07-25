/**
 * Minimalist HEIC Image Viewer
 * Dynamically loads heic2any library via LoadJS for client-side HEIC/HEIF decoding
 */

document.addEventListener("DOMContentLoaded", () => {
  const HEIC2ANY_CDN = "https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js";

  // DOM Elements
  const fileInput = document.getElementById("file");
  const dropZone = document.getElementById("drop-zone");
  const btnSelect = document.getElementById("btn-select");
  const loadingState = document.getElementById("loading-state");
  const loadingText = document.getElementById("loading-text");
  const viewerSection = document.getElementById("viewer-section");
  const thumbnailBar = document.getElementById("thumbnail-bar");
  const demo1 = document.getElementById("demo1");
  const imageStage = document.getElementById("image-stage");

  // Toolbar Elements
  const fileNameEl = document.getElementById("file-name");
  const fileInfoEl = document.getElementById("file-info");
  const zoomLevelEl = document.getElementById("zoom-level");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const btnRotateLeft = document.getElementById("btn-rotate-left");
  const btnRotateRight = document.getElementById("btn-rotate-right");
  const btnReset = document.getElementById("btn-reset");
  const btnDownload = document.getElementById("btn-download");
  const btnNewFile = document.getElementById("btn-new-file");

  // State variables
  let loadedItems = []; // [{ file, blob, url, name }]
  let activeIndex = 0;
  let scale = 1;
  let rotation = 0;
  let isDragging = false;
  let startX = 0, startY = 0;
  let translateX = 0, translateY = 0;

  /**
   * Helper function to dynamically load heic2any open-source library via loadjs
   */
  function ensureHeic2anyLoaded() {
    return new Promise((resolve, reject) => {
      if (window.heic2any) {
        resolve(window.heic2any);
        return;
      }

      if (typeof loadjs === "undefined") {
        reject(new Error("loadjs is not defined. Please include loadjs script."));
        return;
      }

      if (loadjs.isDefined("heic2any")) {
        loadjs.ready("heic2any", {
          success: () => resolve(window.heic2any),
          error: (pathsNotFound) => reject(new Error("Failed to load heic2any: " + pathsNotFound))
        });
        return;
      }

      loadjs([HEIC2ANY_CDN], "heic2any", {
        async: true,
        error: (pathsNotFound) => reject(new Error("Failed to load heic2any CDN: " + pathsNotFound))
      });

      loadjs.ready("heic2any", () => {
        if (window.heic2any) {
          resolve(window.heic2any);
        } else {
          reject(new Error("heic2any library object not found on window."));
        }
      });
    });
  }

  // Pre-fetch heic2any in background using loadjs so it's ready when user selects file
  ensureHeic2anyLoaded().then(() => {
    console.log("heic2any library pre-loaded successfully via loadjs.");
  }).catch((err) => {
    console.warn("Background pre-loading of heic2any failed, will retry on demand:", err);
  });

  // Format file size
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // File Select Triggers
  btnSelect.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener("click", () => {
    fileInput.click();
  });

  // Drag & Drop Handlers
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  });

  // Batch Handle Files
  async function handleFiles(files) {
    const validFiles = files.filter(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      return ['.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp'].includes(ext) || f.type.includes('heic') || f.type.includes('heif');
    });

    if (validFiles.length === 0) {
      alert("Please select valid .heic or .heif image files!");
      return;
    }

    clearLoadedItems();

    dropZone.classList.add("hidden");
    viewerSection.classList.add("hidden");
    loadingState.classList.remove("hidden");

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      loadingText.textContent = `Converting [${i + 1}/${validFiles.length}] ${file.name}...`;

      try {
        let resultBlob;

        if (ext === '.heic' || ext === '.heif' || file.type.includes('heic') || file.type.includes('heif') || ext === '') {
          // Ensure open-source library is loaded via loadjs
          const heic2anyLib = await ensureHeic2anyLoaded();

          // Execute conversion logic
          const converted = await heic2anyLib({
            blob: file,
            toType: "image/jpeg",
            quality: 0.9
          });
          resultBlob = Array.isArray(converted) ? converted[0] : converted;
        } else {
          resultBlob = file;
        }

        const url = URL.createObjectURL(resultBlob);
        console.log("Converted Blob Object URL:", url);

        loadedItems.push({
          file: file,
          blob: resultBlob,
          url: url,
          name: file.name
        });
      } catch (error) {
        console.error(`Error converting file ${file.name}:`, error);
        alert(`Failed to convert ${file.name}. The file might be corrupted or unsupported.`);
      }
    }

    loadingState.classList.add("hidden");

    if (loadedItems.length > 0) {
      renderThumbnails();
      displayImage(0);
      viewerSection.classList.remove("hidden");
    } else {
      dropZone.classList.remove("hidden");
    }
  }

  // Clear memory resources
  function clearLoadedItems() {
    loadedItems.forEach(item => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    loadedItems = [];
    activeIndex = 0;
    thumbnailBar.innerHTML = '';
  }

  // Render thumbnail navigation bar for multiple images
  function renderThumbnails() {
    if (loadedItems.length <= 1) {
      thumbnailBar.classList.add("hidden");
      return;
    }

    thumbnailBar.innerHTML = '';
    loadedItems.forEach((item, index) => {
      const thumb = document.createElement("div");
      thumb.className = `thumb-item ${index === activeIndex ? 'active' : ''}`;
      thumb.innerHTML = `<img src="${item.url}" alt="${item.name}">`;
      thumb.addEventListener("click", () => displayImage(index));
      thumbnailBar.appendChild(thumb);
    });

    thumbnailBar.classList.remove("hidden");
  }

  // Display selected image
  function displayImage(index) {
    if (index < 0 || index >= loadedItems.length) return;
    activeIndex = index;

    const item = loadedItems[index];
    demo1.src = item.url;

    fileNameEl.textContent = item.name;
    fileInfoEl.textContent = `${formatBytes(item.file.size)} → ${formatBytes(item.blob.size)}`;

    const thumbs = thumbnailBar.querySelectorAll(".thumb-item");
    thumbs.forEach((t, i) => t.classList.toggle("active", i === index));

    resetTransform();
  }

  // Transformations (Zoom, Rotate, Pan)
  function updateTransform() {
    demo1.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
    zoomLevelEl.textContent = `${Math.round(scale * 100)}%`;
  }

  function resetTransform() {
    scale = 1;
    rotation = 0;
    translateX = 0;
    translateY = 0;
    updateTransform();
  }

  btnZoomIn.addEventListener("click", () => {
    scale = Math.min(scale + 0.25, 5);
    updateTransform();
  });

  btnZoomOut.addEventListener("click", () => {
    scale = Math.max(scale - 0.25, 0.25);
    updateTransform();
  });

  btnRotateLeft.addEventListener("click", () => {
    rotation -= 90;
    updateTransform();
  });

  btnRotateRight.addEventListener("click", () => {
    rotation += 90;
    updateTransform();
  });

  btnReset.addEventListener("click", resetTransform);

  imageStage.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    scale = Math.min(Math.max(scale + delta, 0.25), 5);
    updateTransform();
  }, { passive: false });

  imageStage.addEventListener("mousedown", (e) => {
    if (e.target === btnDownload || e.target.closest(".toolbar")) return;
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // Download converted JPG
  btnDownload.addEventListener("click", () => {
    if (loadedItems.length === 0 || !loadedItems[activeIndex]) return;

    const item = loadedItems[activeIndex];
    const originalName = item.name;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const downloadName = `${baseName}_converted.jpg`;

    const a = document.createElement("a");
    a.href = item.url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // Re-open new files
  btnNewFile.addEventListener("click", () => {
    clearLoadedItems();
    fileInput.value = "";
    viewerSection.classList.add("hidden");
    dropZone.classList.remove("hidden");
  });
});
