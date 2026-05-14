This guide is to help set up nvidia gpus for docker containers and wsl. This step is necessary for AI/CV functions to work properly in the PR System.

Context:

1. Windows 10/11
2. WSL 2 running Ubuntu 22.04 or 24.04

3. Ensure NVidia Drivers are installed and are correctly being passed from windows to wsl.

- Can be checked by runing "nvidia-smi" in both powershell and wsl for each respective system.

2. Install NVIDIA Container Toolkit into WSL following [these docs](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
