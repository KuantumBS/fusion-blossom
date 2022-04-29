import * as gui3d from './gui3d.js'
import * as THREE from 'three'

// https://www.npmjs.com/package/base64-arraybuffer
var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64_encode (arraybuffer) {
    var bytes = new Uint8Array(arraybuffer), i, len = bytes.length, base64 = ''
    for (i = 0; i < len; i += 3) {
        base64 += chars[bytes[i] >> 2]
        base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)]
        base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)]
        base64 += chars[bytes[i + 2] & 63]
    }
    if (len % 3 === 2) {
        base64 = base64.substring(0, base64.length - 1) + '='
    }
    else if (len % 3 === 1) {
        base64 = base64.substring(0, base64.length - 2) + '=='
    }
    return base64;
}


export async function visualize_paper_weighted_union_find_decoder() {
    this.warning_message = "please adjust your screen to 1920 * 1080 in order to get best draw effect (use developer tool of your browser if your screen resolution is not native 1920 * 1080); The default output image is set to 2634 * 2155 in this case, click \"download\" to save it."
    this.lock_view = true
    // hide virtual nodes
    gui3d.controller.virtual_node_opacity.setValue(0)
    gui3d.controller.virtual_node_outline_opacity.setValue(0)
    gui3d.controller.real_node_opacity.setValue(1)
    gui3d.controller.edge_opacity.setValue(0.05)
    gui3d.controller.node_radius_scale.setValue(0.7)
    gui3d.controller.edge_radius_scale.setValue(0.7)
    await Vue.nextTick()  // make sure all changes have been applied
    // adjust camera location (use `camera.value.position`, `camera.value.quaternion` and `camera.value.zoom` to update it here)
    gui3d.camera.value.position.set(498.95430264554204, 226.03495620714534, 836.631820123962)
    gui3d.camera.value.lookAt(0, 0, 0)
    gui3d.camera.value.zoom = 1.43
    gui3d.camera.value.updateProjectionMatrix()  // need to call after setting zoom
    // remove the bottom nodes
    const fusion_data = gui3d.active_fusion_data.value
    const snapshot_idx = gui3d.active_snapshot_idx.value
    const snapshot = fusion_data.snapshots[snapshot_idx][1]
    for (let [i, node] of snapshot.nodes.entries()) {
        let position = fusion_data.positions[i]
        if (position.t <= -3) {
            const node_mesh = gui3d.node_meshes[i]
            node_mesh.visible = false
            const node_outline_mesh = gui3d.node_outline_meshes[i]
            node_outline_mesh.visible = false
        }
    }
    // remove bottom edges except straight up and down
    for (let [i, edge] of snapshot.edges.entries()) {
        const left_position = fusion_data.positions[edge.l]
        const right_position = fusion_data.positions[edge.r]
        if (left_position.t <= -3 || right_position.t <= -3) {
            let same_i_j = (left_position.i == right_position.i) && (left_position.j == right_position.j)
            if (!same_i_j) {
                for (let edge_meshes of [gui3d.left_edge_meshes, gui3d.middle_edge_meshes, gui3d.right_edge_meshes]) {
                    for (let j of [0, 1]) {
                        const edge_mesh = edge_meshes[i][j]
                        edge_mesh.visible = false
                    }
                }
            }
        }
    }
    // add bottom image
    var image_data
    var image_buffer
    try {
        let response = await fetch('./img/basic_CSS_3D_bottom_image.png')
        image_buffer = await response.arrayBuffer()
        image_data = "data:image/png;base64," + base64_encode(image_buffer)
    } catch (e) {
        this.error_message = "fetch image error"
        throw e
    }
    var bottom_image_texture
    if (gui3d.is_mock) {  // image doesn't work, has to use https://threejs.org/docs/#api/en/textures/DataTexture
        const image = await mocker.read_from_png_buffer(image_buffer)
        bottom_image_texture = new THREE.DataTexture( image.bitmap.data, image.bitmap.width, image.bitmap.height )
        bottom_image_texture.minFilter = THREE.LinearFilter
        bottom_image_texture.flipY = true  // otherwise it's inconsistent with image loader
        bottom_image_texture.needsUpdate = true
    } else {
        const bottom_image_loader = new THREE.TextureLoader()
        bottom_image_texture = await new Promise((resolve, reject) => {
            bottom_image_loader.load(image_data, resolve, undefined, reject)
        })
    }
    const bottom_image_material = new THREE.MeshStandardMaterial({
        map: bottom_image_texture,
        side: THREE.DoubleSide,
    })
    const bottom_image_geometry = new THREE.PlaneGeometry(5, 5, 100, 100)
    const bottom_image_mesh = new THREE.Mesh(bottom_image_geometry, bottom_image_material)
    bottom_image_mesh.position.set(0, -2.8, 0)
    bottom_image_mesh.rotateX(-Math.PI / 2)
    gui3d.scene.add(bottom_image_mesh)
    if (true) {  // add transparent layers
        // change the color of nodes
        const stab_z_material = gui3d.real_node_material.clone()
        stab_z_material.color = new THREE.Color(0xCFE2F3)
        const stab_x_material = gui3d.real_node_material.clone()
        stab_x_material.color = new THREE.Color(0xFFFF00)
        for (let [i, node] of snapshot.nodes.entries()) {
            let position = fusion_data.positions[i]
            const node_mesh = gui3d.node_meshes[i]
            if (!node.s && !node.v) {
                node_mesh.material = position.i % 2 == 0 ? stab_z_material : stab_x_material
            }
        }
        // remove all edges, otherwise too messy
        for (let [i, edge] of snapshot.edges.entries()) {
            if (edge.lg + edge.rg == 0) {
                const left_position = fusion_data.positions[edge.l]
                const right_position = fusion_data.positions[edge.r]
                let same_i_j = (left_position.i == right_position.i) && (left_position.j == right_position.j)
                if (!same_i_j) {
                    for (let edge_meshes of [gui3d.left_edge_meshes, gui3d.middle_edge_meshes, gui3d.right_edge_meshes]) {
                        for (let j of [0, 1]) {
                            const edge_mesh = edge_meshes[i][j]
                            edge_mesh.visible = false
                        }
                    }
                }
            }
        }
        const transparent_layer_material = new THREE.MeshStandardMaterial({
            // color: 0xffff00,
            map: bottom_image_texture,
            opacity: 0.5,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,  // otherwise it will block something...
        })
        for (let i=0; i<3; ++i) {
            const transparent_layer_mesh = new THREE.Mesh(bottom_image_geometry, transparent_layer_material)
            transparent_layer_mesh.position.set(0, -1 + i * 2 -0.01, 0)
            transparent_layer_mesh.rotateX(-Math.PI / 2)
            gui3d.scene.add(transparent_layer_mesh)
        }
    }
    // set background as white to prevent strange pixels around bottom image
    gui3d.scene.background = new THREE.Color( 0xffffff )
    // set output scale
    this.export_scale_selected = Math.pow(10, 3/10)
}