## ./lunar-hardware/Tier_1
# Credits — Tier 1 draft

## Apollo Lunar Module descent stage
Base mesh: NASA / Michael D. Carbajal, Apollo Lunar Module, https://science.nasa.gov/3d-resources/apollo-lunar-module/ . Source GLB: https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/apollo-lunar-module/Apollo%20Lunar%20Module.glb . Repository: https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Apollo%20Lunar%20Module .

Modifications: Draco decoded; nodes below the approximate stage boundary retained; original texture maps and branding removed; flat separation deck added; geometry rescaled, simplified and exported without compression. Surface materials are new PBR approximations.

Rights: NASA makes the model available through its 3D Resources collection. A separate asset-specific license was not found during this pass; review NASA media and 3D resource usage guidance before redistribution. Do not assume endorsement or a blanket CC0 license for the source mesh. https://www.nasa.gov/nasa-brand-center/images-and-media/ .

## Other five models
New procedural geometry authored for this request. No third-party base mesh or photo texture was incorporated. Reference measurements and documents for each item are linked in DIMENSIONS.md. These are simplified reconstructions; references do not certify the resulting geometry. The flag uses original geometric stripes and stars, not a downloaded image. No source photograph was copied into a texture.

## Materials
New metal/roughness materials and generated foil normal/roughness maps; base colors contain no baked lighting. Other materials use constant PBR factors rather than a complete baseColor/normal/ORM texture set. That is a documented departure from the requested texture deliverable, pending material finishing.

## Viewer
Three.js 0.176.0, MIT license; license copy in ../viewer/vendor/LICENSE. Preview renderer, lights, floor and camera are outside the GLBs.

## ./lunar-hardware/Tier_2
# Credits — original Tier 2 concepts

`artemis_lander.glb` and `antenna_dish.glb` are new procedural concept geometry made for this request. No NASA, ISRO, CNSA, company, museum or third-party base mesh was used. No reference photograph or logo is embedded. The user's brief supplied the functional requirements and explicitly authorized original design dimensions for these two concepts.

All base-color, normal and ORM image data were generated for this task. Base colors contain no painted lighting or ambient occlusion. A constant occlusion value of 1 is used; material finishing includes procedural foil normal/roughness and otherwise constant PBR textures and factors. Textures are embedded PNGs of 1x1 or 128x128 pixels. This is a compact concept-material set, not hand-authored production texture art.

The models do not imply endorsement by NASA or any spacecraft manufacturer. The project filename `artemis_lander` follows the requested name; it is not an official Artemis vehicle or an engineering design for flight.

Tooling: Three.js (MIT) and glTF Transform (MIT) for construction/export; Khronos glTF Validator for structural checks. These tools' executable code is not embedded in the GLBs. The separate browser viewer includes Three.js; its license is in ../viewer/vendor/LICENSE.

## ./remaining-lunar-hardware/Tier_2
# Credits and reconstruction status

All meshes in this tier were procedurally constructed for this request. No third-party base mesh, agency logo, national flag, downloaded photograph or commercial brand texture is embedded. This is independently constructed approximate geometry, not a scan or manufacturer CAD.

Each model's reference documents and dimensional limitations are listed under its filename in DIMENSIONS.md. Those documents support particular published anchors or visual arrangements; they do not certify the whole reconstruction. Component sizes without verified drawings are explicitly unverified. Original-concept dimension approval does not turn these historical estimates into verified measurements.

Materials are standard glTF metallic/roughness PBR with embedded PNG base-color, normal and ORM slots. Constant textures/factors are used for plain materials; foil normal/roughness is generated. Base colors contain no baked shadows or illumination. Occlusion maps are neutral (1), not painted AO. The material set is compact and illustrative, not a hand-authored museum-replica finish.

The GLBs contain no lights, cameras, emissive lighting or compression extensions. Preview lighting/camera/ground is external. Tooling: Three.js (MIT), glTF Transform (MIT), glTF Validator; the separately supplied viewer's Three.js license is in ../viewer/vendor/LICENSE. NASA, ISRO, CNSA and Intuitive Machines do not endorse these reconstructions. Review source usage terms before redistributing any separately obtained source images; none are included here.

## ./remaining-lunar-hardware/Tier_3
# Credits and reconstruction status

All meshes in this tier were procedurally constructed for this request. No third-party base mesh, agency logo, national flag, downloaded photograph or commercial brand texture is embedded. This is independently constructed approximate geometry, not a scan or manufacturer CAD.

Each model's reference documents and dimensional limitations are listed under its filename in DIMENSIONS.md. Those documents support particular published anchors or visual arrangements; they do not certify the whole reconstruction. Component sizes without verified drawings are explicitly unverified. Original-concept dimension approval does not turn these historical estimates into verified measurements.

Materials are standard glTF metallic/roughness PBR with embedded PNG base-color, normal and ORM slots. Constant textures/factors are used for plain materials; foil normal/roughness is generated. Base colors contain no baked shadows or illumination. Occlusion maps are neutral (1), not painted AO. The material set is compact and illustrative, not a hand-authored museum-replica finish.

The GLBs contain no lights, cameras, emissive lighting or compression extensions. Preview lighting/camera/ground is external. Tooling: Three.js (MIT), glTF Transform (MIT), glTF Validator; the separately supplied viewer's Three.js license is in ../viewer/vendor/LICENSE. NASA, ISRO, CNSA and Intuitive Machines do not endorse these reconstructions. Review source usage terms before redistributing any separately obtained source images; none are included here.

