# Adds the DeadSetRestActivity widget extension target to DeadSet.xcodeproj.
#
# Done with the xcodeproj library rather than by hand: project.pbxproj is a graph
# of cross-referencing UUIDs across a dozen sections, and hand-editing it is how
# projects get corrupted. This is the same library CocoaPods uses.
#
# Idempotent — running it twice does not create a second target.
#
#   gem install xcodeproj --user-install
#   ruby scripts/add-live-activity-target.rb
#
# Verify afterwards with:
#   xcodebuild -project ios/App/DeadSet.xcodeproj -scheme DeadSet \
#     -destination 'generic/platform=iOS Simulator' build
require "xcodeproj"

PROJECT_PATH = "ios/App/DeadSet.xcodeproj"
APP_TARGET   = "DeadSet"
EXT_TARGET   = "DeadSetRestActivity"
EXT_DIR      = "DeadSetRestActivity"
# The activity is only requested on iOS 16.2+; the app itself still supports 15.
EXT_DEPLOYMENT_TARGET = "16.2"

project = Xcodeproj::Project.open(PROJECT_PATH)
app = project.targets.find { |t| t.name == APP_TARGET }
abort "Could not find the #{APP_TARGET} target" unless app

existing_extension = project.targets.find { |t| t.name == EXT_TARGET }

app_release = app.build_configurations.find { |c| c.name == "Release" }
team = app_release.build_settings["DEVELOPMENT_TEAM"]
app_bundle_id = app_release.build_settings["PRODUCT_BUNDLE_IDENTIFIER"]
marketing_version = app_release.build_settings["MARKETING_VERSION"]
build_version = app_release.build_settings["CURRENT_PROJECT_VERSION"]

# The App target lists its sources explicitly — there is no file-system
# synchronized group — so a Swift file dropped into App/ is NOT compiled until it
# is referenced here. The plugin built "successfully" while being ignored, and the
# Live Activity silently never started.
def ensure_app_source(project, app, group_name, filename)
  group = project.main_group.children.find { |c| c.display_name == group_name }
  raise "Could not find the #{group_name} group" unless group
  ref = group.files.find { |f| f.display_name == filename }
  ref ||= group.new_reference(filename)
  already = app.source_build_phase.files.any? { |f| f.file_ref == ref }
  app.add_file_references([ref]) unless already
  already ? :present : :added
end

plugin_state = ensure_app_source(project, app, "App", "RestActivityPlugin.swift")
puts "RestActivityPlugin.swift in App target: #{plugin_state}"

if existing_extension
  project.save
  puts "#{EXT_TARGET} already exists — left as is."
  exit 0
end

extension_target = project.new_target(
  :app_extension,
  EXT_TARGET,
  :ios,
  EXT_DEPLOYMENT_TARGET,
  nil,
  :swift
)

group = project.main_group.new_group(EXT_TARGET, EXT_DIR)
attributes_ref = group.new_reference("RestActivityAttributes.swift")
activity_ref = group.new_reference("RestLiveActivity.swift")
assets_ref = group.new_reference("Assets.xcassets")
group.new_reference("Info.plist")

extension_target.add_file_references([attributes_ref, activity_ref])
extension_target.add_resources([assets_ref])

# The attributes type must compile into BOTH targets: the app requests the
# activity, the extension renders it, and they have to agree on the type. If only
# one has it, Activity.request fails at runtime with nothing logged.
app.add_file_references([attributes_ref])

extension_target.build_configurations.each do |config|
  settings = config.build_settings
  # Without PRODUCT_NAME the product builds as ".appex" with an empty name,
  # which collides with itself during the universal-binary step.
  settings["PRODUCT_NAME"] = "$(TARGET_NAME)"
  settings["PRODUCT_BUNDLE_IDENTIFIER"] = "#{app_bundle_id}.RestActivity"
  settings["INFOPLIST_FILE"] = "#{EXT_DIR}/Info.plist"
  settings["IPHONEOS_DEPLOYMENT_TARGET"] = EXT_DEPLOYMENT_TARGET
  settings["SWIFT_VERSION"] = "5.0"
  settings["TARGETED_DEVICE_FAMILY"] = "1"
  settings["MARKETING_VERSION"] = marketing_version
  settings["CURRENT_PROJECT_VERSION"] = build_version
  settings["DEVELOPMENT_TEAM"] = team
  settings["CODE_SIGN_STYLE"] = "Automatic"
  # Extensions ship inside the app, never installed on their own.
  settings["SKIP_INSTALL"] = "YES"
  settings["GENERATE_INFOPLIST_FILE"] = "YES"
  settings["INFOPLIST_KEY_CFBundleDisplayName"] = "Rest Timer"
  settings["INFOPLIST_KEY_NSHumanReadableCopyright"] = ""
  settings["CURRENT_PROJECT_VERSION"] = build_version
  settings["SWIFT_EMIT_LOC_STRINGS"] = "YES"
  settings["ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME"] = ""
end

# Embed the extension in the app, and make the app depend on it so a clean build
# produces the extension first.
app.add_dependency(extension_target)

embed_phase = app.build_phases.find do |phase|
  phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) &&
    phase.name == "Embed Foundation Extensions"
end
unless embed_phase
  embed_phase = app.new_copy_files_build_phase("Embed Foundation Extensions")
  embed_phase.symbol_dst_subfolder_spec = :plug_ins
end
build_file = embed_phase.add_file_reference(extension_target.product_reference)
build_file.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save
puts "Added #{EXT_TARGET} to #{PROJECT_PATH}"
puts "  bundle id: #{app_bundle_id}.RestActivity"
puts "  team:      #{team}"
puts "  min iOS:   #{EXT_DEPLOYMENT_TARGET}"
