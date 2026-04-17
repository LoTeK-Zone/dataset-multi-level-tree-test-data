/*
Author: Stephan Kühn (LoTeK)
Mail: info@lotek-zone.com
Web: https://lotek-zone.com/
GitHub: https://github.com/LoTeK-Zone
Repository: https://github.com/LoTeK-Zone/dataset-multi-level-tree-test-data
Version: 0.1.0
Last Updated: 18.04.2026
License: MIT
*/

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function normalizeText(text) {
  return String(text ?? '').replace(/^\uFEFF/, '')
}

function xmlToDom(xmlText) {
  return new DOMParser().parseFromString(xmlText, 'application/xml')
}

function csvToRows(text) {
  const rows = []
  let row = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        value += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        value += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(value)
        value = ''
      } else if (ch === '\n') {
        row.push(value)
        rows.push(row)
        row = []
        value = ''
      } else if (ch !== '\r') {
        value += ch
      }
    }
  }

  if (value.length || row.length) {
    row.push(value)
    rows.push(row)
  }

  const headers = rows.shift() || []

  return rows
    .filter(r => r.length && r.some(v => v !== ''))
    .map(r => {
      const obj = {}
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? ''
      })
      return obj
    })
}

function appendNestedNodes(parent, nodes) {
  nodes.forEach(node => {
    const li = document.createElement('li')
    li.innerHTML = `<span class="tree-node"><span class="tree-name">${escapeHtml(node.node_name)}</span><span class="tree-info">L${node.node_level}</span></span>`

    if (node.children && node.children.length) {
      const ul = document.createElement('ul')
      appendNestedNodes(ul, node.children)
      li.appendChild(ul)
    }

    parent.appendChild(li)
  })
}

function renderNestedTrees(trees, container) {
  container.innerHTML = ''

  trees.forEach(tree => {
    const block = document.createElement('section')
    block.className = 'tree-block'

    const title = document.createElement('h2')
    title.textContent = tree.heading || tree.tree_name
    block.appendChild(title)

    const meta = document.createElement('div')
    meta.className = 'meta'
    meta.textContent = `Tree ID: ${tree.tree_id} | Root: ${tree.root_name} | Levels: ${tree.declared_levels}`
    block.appendChild(meta)

    const ul = document.createElement('ul')
    ul.className = 'tree-list'

    const rootLi = document.createElement('li')
    rootLi.innerHTML = `<span class="tree-node"><span class="tree-name">${escapeHtml(tree.root_name)}</span><span class="tree-info">(root)</span></span>`

    const childrenUl = document.createElement('ul')
    appendNestedNodes(childrenUl, tree.children || [])
    rootLi.appendChild(childrenUl)
    ul.appendChild(rootLi)

    block.appendChild(ul)
    container.appendChild(block)
  })
}

function filterRenderedTrees(input, container) {
  const term = input.value.trim().toLowerCase()
  const blocks = Array.from(container.querySelectorAll('.tree-block'))

  blocks.forEach(block => {
    block.classList.toggle('hidden', term && !block.textContent.toLowerCase().includes(term))
  })
}

function flatRowsToNestedTrees(inputRows) {
  let rows = inputRows

  if (!Array.isArray(rows)) {
    if (rows && Array.isArray(rows.rows)) rows = rows.rows
    else if (rows && Array.isArray(rows.nodes)) rows = rows.nodes
    else if (rows && Array.isArray(rows.items)) rows = rows.items
    else throw new Error('Flat node input is not an array')
  }

  const treeMap = new Map()
  const nodeMap = new Map()

  rows.forEach(row => {
    const treeId = row.tree_id
    if (!treeId) return

    if (!treeMap.has(treeId)) {
      treeMap.set(treeId, {
        tree_id: treeId,
        tree_name: row.tree_name || '',
        heading: row.tree_title || `${row.tree_name} - ${row.declared_levels} Levels`,
        depth_group: row.depth_group || '',
        declared_levels: Number(row.declared_levels || 0),
        root_name: row.tree_name || '',
        children: []
      })
    }

    const isRoot = row.is_root === 1 || row.is_root === '1' || row.isRoot === 1 || row.isRoot === '1' || Number(row.node_level) === 0

    if (isRoot) {
      const tree = treeMap.get(treeId)
      tree.root_name = row.node_name || row.tree_name || tree.root_name
      return
    }

    nodeMap.set(row.node_id, {
      node_id: row.node_id,
      parent_id: row.parent_id || '',
      tree_id: row.tree_id,
      node_name: row.node_name,
      node_level: Number(row.node_level || 0),
      sort_order: Number(row.sort_order || 0),
      path: row.path || '',
      children: []
    })
  })

  const nodes = Array.from(nodeMap.values()).sort((a, b) => {
    if (a.tree_id !== b.tree_id) return a.tree_id.localeCompare(b.tree_id)
    if (a.node_level !== b.node_level) return a.node_level - b.node_level
    return a.sort_order - b.sort_order
  })

  nodes.forEach(node => {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id).children.push(node)
    } else {
      treeMap.get(node.tree_id).children.push(node)
    }
  })

  return Array.from(treeMap.values())
}

function parseNestedJson(text) {
  const parsed = JSON.parse(text)

  if (!parsed || !Array.isArray(parsed.trees)) {
    throw new Error('Nested JSON format not recognized')
  }

  return parsed.trees.map(tree => ({
    tree_id: tree.tree_id || '',
    tree_name: tree.tree_name || '',
    heading: tree.title || tree.tree_name || '',
    depth_group: tree.depth_group || '',
    declared_levels: Number(tree.declared_levels || 0),
    root_name: tree.root?.name || tree.tree_name || '',
    children: normalizeNestedJsonChildren(tree.root?.children || [], 1)
  }))
}

function normalizeNestedJsonChildren(children, level) {
  return (children || []).map(child => ({
    node_name: child.name || '',
    node_level: level,
    children: normalizeNestedJsonChildren(child.children || [], level + 1)
  }))
}

function parseNestedXmlNode(nodeEl) {
  const level = Number(nodeEl.getAttribute('level') || 0)
  const childNodeEls = Array.from(nodeEl.children).filter(el => el.tagName === 'node')

  return {
    node_name: nodeEl.getAttribute('name') || '',
    node_level: level,
    children: childNodeEls.map(parseNestedXmlNode)
  }
}

function parseNestedXml(xmlText) {
  const dom = xmlToDom(xmlText)
  const treeEls = Array.from(dom.getElementsByTagName('tree'))

  return treeEls.map(treeEl => {
    const rootNodeEl = Array.from(treeEl.children).find(el => el.tagName === 'node')

    return {
      tree_id: treeEl.getAttribute('treeId') || '',
      tree_name: treeEl.getAttribute('treeName') || '',
      heading: treeEl.getAttribute('title') || treeEl.getAttribute('treeName') || '',
      depth_group: treeEl.getAttribute('depthGroup') || '',
      declared_levels: Number(treeEl.getAttribute('declaredLevels') || 0),
      root_name: rootNodeEl ? (rootNodeEl.getAttribute('name') || '') : '',
      children: rootNodeEl
        ? Array.from(rootNodeEl.children).filter(el => el.tagName === 'node').map(parseNestedXmlNode)
        : []
    }
  })
}

function parseFlatXml(xmlText) {
  const dom = xmlToDom(xmlText)

  return Array.from(dom.getElementsByTagName('node')).map(el => ({
    node_id: el.getAttribute('nodeId') || '',
    tree_id: el.getAttribute('treeId') || '',
    tree_name: el.getAttribute('treeName') || '',
    tree_title: el.getAttribute('treeTitle') || '',
    depth_group: el.getAttribute('depthGroup') || '',
    declared_levels: Number(el.getAttribute('declaredLevels') || 0),
    parent_id: el.getAttribute('parentId') || '',
    node_level: Number(el.getAttribute('nodeLevel') || 0),
    sort_order: Number(el.getAttribute('sortOrder') || 0),
    node_name: el.getAttribute('nodeName') || '',
    path: el.getAttribute('path') || '',
    is_root: el.getAttribute('isRoot') || '0',
    child_count: Number(el.getAttribute('childCount') || 0)
  }))
}

function parseMarkdownTrees(mdText) {
  const lines = mdText.split(/\r?\n/)
  const trees = []
  let currentGroup = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      currentGroup = line.slice(3).trim()
      continue
    }

    if (line.startsWith('### ')) {
      const heading = line.slice(4).trim()
      let j = i + 1

      while (j < lines.length && !lines[j].trim()) j++

      const root = lines[j] ? lines[j].trim() : ''
      const bullets = []
      j++

      while (j < lines.length && !lines[j].startsWith('## ') && !lines[j].startsWith('### ')) {
        if (lines[j].trim()) bullets.push(lines[j])
        j++
      }

      const tree = {
        tree_id: heading.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        tree_name: heading.replace(/\s*-\s*\d+\s+Levels$/, ''),
        heading: heading,
        depth_group: currentGroup,
        declared_levels: Number((heading.match(/(\d+)\s+Levels$/) || [])[1] || 0),
        root_name: root,
        children: []
      }

      const stack = [{ indent: -1, target: tree }]

      bullets.forEach(bl => {
        const match = bl.match(/^(\s*)-\s+(.+)$/)
        if (!match) return

        const indent = Math.floor(match[1].length / 2)

        const node = {
          node_name: match[2].trim(),
          node_level: indent + 1,
          children: []
        }

        while (stack.length && stack[stack.length - 1].indent >= indent) {
          stack.pop()
        }

        stack[stack.length - 1].target.children.push(node)
        stack.push({ indent, target: node })
      })

      trees.push(tree)
      i = j - 1
    }
  }

  return trees
}

function detectSourceType(fileName) {
  const lower = fileName.toLowerCase()

  if (lower.includes('flat-nodes-tree') && (lower.endsWith('.json') || lower.endsWith('.json.txt'))) return 'json-flat'
  if (lower.includes('nested-tree') && (lower.endsWith('.json') || lower.endsWith('.json.txt'))) return 'json-nested'
  if (lower.includes('flat-nodes-tree') && (lower.endsWith('.xml') || lower.endsWith('.xml.txt'))) return 'xml-flat'
  if (lower.includes('nested-tree') && (lower.endsWith('.xml') || lower.endsWith('.xml.txt'))) return 'xml-nested'
  if (lower.endsWith('.csv') || lower.endsWith('.csv.txt')) return 'csv-flat'
  if (lower.endsWith('.md') || lower.endsWith('.md.txt')) return 'markdown-tree'

  throw new Error(`Unsupported file name: ${fileName}`)
}

function parseSourceTextByType(sourceType, rawText) {
  const text = normalizeText(rawText)

  if (sourceType === 'json-nested') return parseNestedJson(text)
  if (sourceType === 'json-flat') return flatRowsToNestedTrees(JSON.parse(text))
  if (sourceType === 'xml-nested') return parseNestedXml(text)
  if (sourceType === 'xml-flat') return flatRowsToNestedTrees(parseFlatXml(text))
  if (sourceType === 'csv-flat') return flatRowsToNestedTrees(csvToRows(text))
  if (sourceType === 'markdown-tree') return parseMarkdownTrees(text)

  throw new Error(`Unknown type: ${sourceType}`)
}

async function bootstrapDemo() {
  const app = document.getElementById('app')
  const status = document.getElementById('status')
  const fileInput = document.getElementById('fileInput')
  const filter = document.getElementById('filter')

  filter.addEventListener('input', () => filterRenderedTrees(filter, app))

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0]
    if (!file) return

    try {
      const text = await file.text()
      const sourceType = detectSourceType(file.name)
      const trees = parseSourceTextByType(sourceType, text)
      renderNestedTrees(trees, app)
      status.textContent = `Loaded ${trees.length} trees from ${file.name} | Type: ${sourceType}`
    } catch (error) {
      status.textContent = error.message
      app.innerHTML = `<pre>${escapeHtml(String(error.stack || error.message || error))}</pre>`
    }
  })
}

document.addEventListener('DOMContentLoaded', bootstrapDemo)