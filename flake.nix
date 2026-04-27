{
  description = "bong-registry";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";

    uv2nix = {
      url = "github:pyproject-nix/uv2nix";
      inputs.pyproject-nix.follows = "pyproject-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pyproject-nix = {
      url = "github:pyproject-nix/pyproject.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    pyproject-build-systems = {
      url = "github:pyproject-nix/build-system-pkgs";
      inputs.pyproject-nix.follows = "pyproject-nix";
      inputs.uv2nix.follows = "uv2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      uv2nix,
      pyproject-nix,
      pyproject-build-systems,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        inherit (nixpkgs) lib;
        pkgs = nixpkgs.legacyPackages.${system};

        # ------------------------------------------------------------------ #
        # Backend — Python venv via uv2nix
        # ------------------------------------------------------------------ #
        workspace = uv2nix.lib.workspace.loadWorkspace {
          workspaceRoot = ./backend;
        };

        overlay = workspace.mkPyprojectOverlay {
          sourcePreference = "wheel";
        };

        pythonSet = (pkgs.callPackage pyproject-nix.build.packages {
          python = pkgs.python313;
        }).overrideScope (lib.composeManyExtensions [
          pyproject-build-systems.overlays.default
          overlay
        ]);

        backendVenv = pythonSet.mkVirtualEnv "bong-registry-backend-env"
          workspace.deps.default;

        # ------------------------------------------------------------------ #
        # Dev shell package groups
        # ------------------------------------------------------------------ #
        k8sPackages = with pkgs; [
          kubectl
          kubernetes-helm
          k9s
          skopeo
        ];

        backendPackages = [
          backendVenv
          pkgs.python313
          pkgs.uv
          pkgs.just
          pkgs.postgresql
        ];

        frontendPackages = with pkgs; [
          nodejs_24
          just
        ];

        # ------------------------------------------------------------------ #
        # OCI images — Phase 4 (uncomment when frontend/ exists)
        # ------------------------------------------------------------------ #
        # backendImage = pkgs.dockerTools.streamLayeredImage { ... };
        # frontendImage = pkgs.dockerTools.streamLayeredImage { ... };

      in
      {
        # packages = {
        #   backend-image = backendImage;
        #   frontend-image = frontendImage;
        # };

        devShells = {
          default = pkgs.mkShell {
            name = "bong-registry";
            packages = k8sPackages ++ backendPackages ++ frontendPackages;
            shellHook = ''
              echo "bong-registry dev shell"
              echo "  node $(node --version)  |  python $(python3 --version)  |  uvicorn $(uvicorn --version)"
            '';
          };

          backend = pkgs.mkShell {
            name = "bong-registry-backend";
            packages = backendPackages;
          };

          frontend = pkgs.mkShell {
            name = "bong-registry-frontend";
            packages = frontendPackages;
          };

          k8s = pkgs.mkShell {
            name = "bong-registry-k8s";
            packages = k8sPackages;
          };
        };
      }
    );
}
